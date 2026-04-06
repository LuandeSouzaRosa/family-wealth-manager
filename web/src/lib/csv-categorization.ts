export interface CategorizationRule {
  texto_contem: string;
  categoria_destino: string;
  created_at?: string | null;
}

const DEFAULT_CATEGORY = "Outros";

function normalizeText(value: string | null | undefined): string {
  return (value || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeRuleText(value: string): string {
  // Remove noise like partial dates (dd/mm) and partial hours (hh:mm)
  let clean = value.replace(/\b\d{2}\/\d{2}\b/g, " ").replace(/\b\d{2}:\d{2}\b/g, " ");
  // Remove extraneous floating tokens
  clean = clean.replace(/\s*-\s*-/g, " - ");
  return clean.replace(/\s+/g, " ").trim();
}

function extractRuleAliasFromDescription(descricao: string): string | null {
  const normalized = sanitizeRuleText(descricao);

  const pixMatch = normalized.match(
    /^(?:transfer[e\u00ea]ncia enviada pelo pix|pix\s*-\s*enviado)\s*-\s*(.+?)(?:\s*-\s*(?:\d|\u2022)|$)/i
  );
  if (pixMatch?.[1]) return sanitizeRuleText(pixMatch[1]);

  const debitoMatch = normalized.match(/^(?:compra no d[e\u00e9]bito|compra com cart[a\u00e3]o)\s*-\s*(.+?)(?:\s*-\s*(?:\d|\u2022)|$)/i);
  if (debitoMatch?.[1]) return sanitizeRuleText(debitoMatch[1]);

  const boletoMatch = normalized.match(/^(?:pagamento de boleto efetuado|pagamento de impostos)\s*-\s*(.+?)(?:\s*-\s*(?:\d|\u2022)|$)/i);
  if (boletoMatch?.[1]) return sanitizeRuleText(boletoMatch[1]);

  return null;
}

function buildRuleTokens(textoContem: string): string[] {
  const normalizedPrimary = normalizeText(textoContem);
  if (!normalizedPrimary) return [];

  const alias = extractRuleAliasFromDescription(textoContem);
  const normalizedAlias = alias ? normalizeText(alias) : "";

  if (!normalizedAlias || normalizedAlias === normalizedPrimary) {
    return [normalizedPrimary];
  }

  return [normalizedPrimary, normalizedAlias];
}

function getCreatedAtScore(createdAt?: string | null): number {
  if (!createdAt) return 0;
  const timestamp = Date.parse(createdAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function inferCategoryByHeuristic(normalizedDescription: string): string | null {
  // Heuristica de fallback de baixo risco para elevar utilidade do insight sem sobrescrever regras do usuario.
  if (normalizedDescription.includes("pagamento de fatura") || normalizedDescription.includes("pagto cartao") || normalizedDescription.includes("pagamento de boleto") && normalizedDescription.includes("cartao")) return "Fatura Cartao";
  
  if (
    (normalizedDescription.includes("transferencia enviada") || normalizedDescription.includes("pix enviado")) &&
    normalizedDescription.includes("juliana patricio martello")
  ) {
    return "Moradia";
  }
  
  if (normalizedDescription.includes("dare santa catarina") || normalizedDescription.includes("ipva")) {
    return "Transporte"; // IPVA is typically related to car/transport
  }

  if ((normalizedDescription.includes("compra no debito") || normalizedDescription.includes("compra com cartao")) && normalizedDescription.includes("administradora")) {
    return "Moradia";
  }
  if (normalizedDescription.includes("milium loja") || normalizedDescription.includes("cassol")) {
    return "Moradia";
  }
  if (
    normalizedDescription.includes("pagamento de boleto efetuado") &&
    normalizedDescription.includes("sefaz")
  ) {
    return "Transporte";
  }
  
  if (
    (normalizedDescription.includes("transferencia enviada") || normalizedDescription.includes("pix enviado")) &&
    (normalizedDescription.includes("banco xp") || normalizedDescription.includes("nu invest") || normalizedDescription.includes("rico") || normalizedDescription.includes("ideal corretora") || normalizedDescription.includes("btg"))
  ) {
    return "Investimentos";
  }

  if (normalizedDescription.includes("farmacia") || normalizedDescription.includes("drogaria") || normalizedDescription.includes("panvel")) {
    return "Saúde";
  }
  
  if (normalizedDescription.includes("uber ") || normalizedDescription.includes("99app") || normalizedDescription.includes("posto ") || normalizedDescription.includes("auto posto") || normalizedDescription.includes("estacionamento")) {
    return "Transporte";
  }

  if (normalizedDescription.includes("tim s a") || normalizedDescription.includes("claro sa") || normalizedDescription.includes("vivo")) {
    return "Contas Residenciais";
  }

  if (
    normalizedDescription.includes("ifood") ||
    normalizedDescription.includes("restaurante") ||
    normalizedDescription.includes("fast food") ||
    normalizedDescription.includes("marmitas") ||
    normalizedDescription.includes("supermercado") ||
    normalizedDescription.includes("market") ||
    normalizedDescription.includes("martendal") ||
    normalizedDescription.includes("bistek") ||
    normalizedDescription.includes("pan de amore")
  ) {
    return "Alimentação";
  }
  
  return null;
}

export function deriveRuleTextFromDescription(descricao: string): string {
  const trimmed = sanitizeRuleText(descricao);
  if (!trimmed) return "";

  const alias = extractRuleAliasFromDescription(trimmed);
  if (!alias || alias.length < 4) return trimmed;

  return alias;
}

export function categorizeImportedDescription(
  descricao: string,
  rules: CategorizationRule[]
): string {
  const normalizedDescription = normalizeText(descricao);
  if (!normalizedDescription) return DEFAULT_CATEGORY;

  const candidates: Array<{
    categoria: string;
    tokenLength: number;
    createdAtScore: number;
    ruleIndex: number;
    tokenIndex: number;
  }> = [];

  rules.forEach((rule, ruleIndex) => {
    const category = rule.categoria_destino?.trim();
    if (!category) return;

    const tokens = buildRuleTokens(rule.texto_contem);
    tokens.forEach((token, tokenIndex) => {
      if (token.length < 3) return;
      if (!normalizedDescription.includes(token)) return;

      candidates.push({
        categoria: category,
        tokenLength: token.length,
        createdAtScore: getCreatedAtScore(rule.created_at),
        ruleIndex,
        tokenIndex,
      });
    });
  });

  if (candidates.length === 0) {
    return inferCategoryByHeuristic(normalizedDescription) || DEFAULT_CATEGORY;
  }

  candidates.sort((a, b) => {
    if (b.tokenLength !== a.tokenLength) return b.tokenLength - a.tokenLength;
    if (b.createdAtScore !== a.createdAtScore) return b.createdAtScore - a.createdAtScore;
    if (a.ruleIndex !== b.ruleIndex) return a.ruleIndex - b.ruleIndex;
    return a.tokenIndex - b.tokenIndex;
  });

  return candidates[0].categoria;
}
