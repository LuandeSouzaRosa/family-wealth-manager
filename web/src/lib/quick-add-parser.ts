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

export type QuickAddResult = 
  | { success: true; data: ParsedTransaction }
  | { success: false; error: string };

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
 * Returns discriminated union with explicit error messages if invalid.
 */
export function parseQuickAdd(text: string): QuickAddResult {
  if (!text || text.trim().length === 0) {
    return { success: false, error: "Digite algo para adicionar." };
  }

  const input = text.trim();
  const lower = input.toLowerCase();

  // 1. Extract value 
  const valueMatches = input.match(/(\d+([.,]\d+)?)/g);
  if (!valueMatches || valueMatches.length === 0) {
    return { success: false, error: "Não identifiquei o valor." };
  }

  let valorStr = "";
  let stringToErase = "";

  if (valueMatches.length > 1) {
    // Multiple numbers detected
    const withCents = valueMatches.filter(v => v.includes(",") || v.includes("."));
    const hasMonetary = lower.match(/(?:r\$|rs)\s*(\d+([.,]\d+)?)/);
    
    if (hasMonetary) {
      valorStr = hasMonetary[1];
      stringToErase = hasMonetary[0]; // Erase the R$ part as well so it doesn't pollute description
    } else if (withCents.length === 1) {
      // Only one number has decimal formatting, highly likely to be the money
      valorStr = withCents[0];
      stringToErase = valorStr;
    } else {
      return { success: false, error: "Múltiplos números detectados. Use R$ antes do valor para ser exato." };
    }
  } else {
    valorStr = valueMatches[0];
    stringToErase = valorStr;
  }

  const parsedValueStr = valorStr.replace(",", ".");
  const valor = parseFloat(parsedValueStr);
  if (isNaN(valor) || valor <= 0) {
    return { success: false, error: "Valor numérico inválido." };
  }

  // 2. Extract date keyword
  let data = new Date();
  let dateKeywordFound = "";

  const diaMatch = lower.match(/\bdia\s+(\d+)\b/);
  if (diaMatch) {
    const diaNum = parseInt(diaMatch[1], 10);
    if (diaNum >= 1 && diaNum <= 31) {
      data.setDate(diaNum);
    }
    dateKeywordFound = diaMatch[0];
  } else {
    for (const [keyword, getDate] of Object.entries(DATE_KEYWORDS)) {
      if (lower.includes(keyword)) {
        data = getDate();
        dateKeywordFound = keyword;
        break;
      }
    }
  }

  // 3. Build description
  // Escape regex special chars from stringToErase just in case
  const safeErase = stringToErase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let descricao = input.replace(new RegExp(safeErase, "i"), "").trim();

  if (dateKeywordFound) {
    descricao = descricao.replace(new RegExp(dateKeywordFound, "i"), "").trim();
  }

  // Remove common filler words
  const FILLER_WORDS = [
    "crédito", "credito", "débito", "debito", "pix", "cartão", "cartao", "conta",
    "paguei", "comprei", "gastei"
  ];
  for (const filler of FILLER_WORDS) {
    descricao = descricao.replace(new RegExp(`\\b${filler}\\b`, "gi"), "").trim();
  }

  // Clean up extra spaces
  descricao = descricao.replace(/\s+/g, " ").trim();

  // Validate description (NO FALLBACK)
  if (descricao.length < 2 || !/[a-zA-ZÀ-ÿ]/.test(descricao)) {
    return { success: false, error: "Descreva o gasto com pelo menos uma palavra." };
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

  if (isIncome && categoria === "Outros") {
    categoria = "Salário";
  }

  return { 
    success: true, 
    data: { descricao, valor, tipo, categoria, data } 
  };
}
