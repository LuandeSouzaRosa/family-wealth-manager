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
  return value.replace(/\s+/g, " ").trim();
}

function extractRuleAliasFromDescription(descricao: string): string | null {
  const normalized = sanitizeRuleText(descricao);

  const pixMatch = normalized.match(
    /^transfer[e\u00ea]ncia enviada pelo pix\s*-\s*(.+?)\s*-\s*(?:\d|\u2022)/i
  );
  if (pixMatch?.[1]) return sanitizeRuleText(pixMatch[1]);

  const debitoMatch = normalized.match(/^compra no d[e\u00e9]bito\s*-\s*(.+)$/i);
  if (debitoMatch?.[1]) return sanitizeRuleText(debitoMatch[1]);

  const boletoMatch = normalized.match(/^pagamento de boleto efetuado\s*-\s*(.+)$/i);
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
  if (normalizedDescription.includes("pagamento de fatura")) return "Fatura Cartao";
  if (
    normalizedDescription.includes("pagamento de boleto efetuado") &&
    normalizedDescription.includes("sefaz")
  ) {
    return "Transporte";
  }
  if (
    normalizedDescription.includes("transferencia enviada pelo pix") &&
    normalizedDescription.includes("banco xp")
  ) {
    return "Investimentos";
  }
  if (
    normalizedDescription.includes("ifood") ||
    normalizedDescription.includes("restaurante") ||
    normalizedDescription.includes("fast food") ||
    normalizedDescription.includes("marmitas") ||
    normalizedDescription.includes("supermercado") ||
    normalizedDescription.includes("market") ||
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
