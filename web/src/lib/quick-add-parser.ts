/**
 * Quick Add Parser — Extrai transação de texto natural.
 *
 * Exemplos suportados:
 *   "ifood 45 ontem"          → { descricao: "ifood", valor: 45, data: ontem, tipo: "Saída" }
 *   "uber 23 hoje"            → { descricao: "uber", valor: 23, data: hoje,  tipo: "Saída" }
 *   "salário 3000"            → { descricao: "salário", valor: 3000, tipo: "Entrada" }
 *   "mercado 120 crédito"     → { descricao: "mercado", valor: 120, tipo: "Saída" }
 *   "50 padaria"              → { descricao: "padaria", valor: 50, tipo: "Saída" }
 */

export interface ParsedTransaction {
  descricao: string;
  valor: number;
  tipo: "Entrada" | "Saída";
  categoria: string;
  data: Date;
}

// Keywords that indicate income (Entrada)
const INCOME_KEYWORDS = [
  "salário", "salario", "freelance", "renda", "recebimento",
  "dividendo", "dividendos", "rendimento", "cashback", "reembolso",
  "pix recebido", "transferência recebida",
];

// Date keywords
const DATE_KEYWORDS: Record<string, () => Date> = {
  "hoje": () => new Date(),
  "ontem": () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  },
  "anteontem": () => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return d;
  },
};

// Category auto-detection by keyword
const CATEGORY_HINTS: Record<string, string[]> = {
  "Alimentação": [
    "ifood", "food", "restaurante", "almoço", "almoco", "jantar", "café", "cafe",
    "padaria", "mercado", "supermercado", "lanche", "pizza", "hamburguer",
    "sushi", "açaí", "acai", "comida", "refeição",
  ],
  "Transporte": [
    "uber", "99", "gasolina", "combustível", "combustivel", "estacionamento",
    "pedágio", "pedagio", "ônibus", "onibus", "metrô", "metro", "táxi", "taxi",
    "cabify",
  ],
  "Moradia": [
    "aluguel", "condomínio", "condominio", "luz", "energia", "água", "agua",
    "gás", "gas", "internet", "iptu",
  ],
  "Saúde": [
    "farmácia", "farmacia", "remédio", "remedio", "médico", "medico",
    "dentista", "academia", "gym", "plano de saúde",
  ],
  "Lazer": [
    "cinema", "netflix", "spotify", "show", "teatro", "bar", "festa",
    "viagem", "hotel", "passeio", "parque",
  ],
  "Assinaturas": [
    "assinatura", "streaming", "hbo", "disney", "amazon prime", "youtube",
    "icloud", "google one",
  ],
  "Educação": [
    "curso", "livro", "escola", "faculdade", "mensalidade", "udemy",
    "alura", "treinamento",
  ],
  "Compras": [
    "roupa", "shopping", "sapato", "eletrônico", "eletronico", "presente",
    "acessório", "acessorio",
  ],
  "Salário": [
    "salário", "salario", "pagamento", "holerite",
  ],
  "Investimento": [
    "investimento", "ação", "acao", "fundo", "cdb", "tesouro",
    "cripto", "bitcoin", "etf",
  ],
};

/**
 * Parses a natural language string into a transaction.
 * Returns null if no value could be extracted.
 */
export function parseQuickAdd(text: string): ParsedTransaction | null {
  if (!text || text.trim().length === 0) return null;

  const input = text.trim();
  const lower = input.toLowerCase();

  // 1. Extract value (first number in the text)
  const valueMatch = input.match(/(\d+([.,]\d+)?)/);
  if (!valueMatch) return null;

  const valorStr = valueMatch[0].replace(",", ".");
  const valor = parseFloat(valorStr);
  if (isNaN(valor) || valor <= 0) return null;

  // 2. Extract date keyword
  let data = new Date();
  let dateKeywordFound = "";
  for (const [keyword, getDate] of Object.entries(DATE_KEYWORDS)) {
    if (lower.includes(keyword)) {
      data = getDate();
      dateKeywordFound = keyword;
      break;
    }
  }

  // 3. Build description (remove value and date keyword)
  let descricao = input
    .replace(valueMatch[0], "")
    .trim();

  if (dateKeywordFound) {
    descricao = descricao.replace(new RegExp(dateKeywordFound, "i"), "").trim();
  }

  // Remove common filler words that might be left
  const FILLER_WORDS = ["crédito", "credito", "débito", "debito", "pix", "cartão", "cartao", "conta"];
  for (const filler of FILLER_WORDS) {
    descricao = descricao.replace(new RegExp(`\\b${filler}\\b`, "gi"), "").trim();
  }

  // Clean up extra spaces
  descricao = descricao.replace(/\s+/g, " ").trim();

  // Fallback description
  if (!descricao) {
    descricao = "Gasto Rápido";
  }

  // Capitalize first letter
  descricao = descricao.charAt(0).toUpperCase() + descricao.slice(1);

  // 4. Detect type (Entrada vs Saída)
  const isIncome = INCOME_KEYWORDS.some((kw) => lower.includes(kw));
  const tipo: "Entrada" | "Saída" = isIncome ? "Entrada" : "Saída";

  // 5. Auto-detect category
  let categoria = "Outros";
  for (const [cat, keywords] of Object.entries(CATEGORY_HINTS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      categoria = cat;
      break;
    }
  }

  // For income, default to Salário if no specific category matched
  if (isIncome && categoria === "Outros") {
    categoria = "Salário";
  }

  return { descricao, valor, tipo, categoria, data };
}
