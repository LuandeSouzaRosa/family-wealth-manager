export type CsvCanonicalField = "descricao" | "data" | "valor";

const CSV_HEADER_ALIASES: Record<CsvCanonicalField, string[]> = {
  descricao: ["descricao", "descri\u00e7\u00e3o", "description", "historico", "hist\u00f3rico"],
  data: ["data", "date"],
  valor: ["valor", "value", "amount"],
};

function normalizeCsvHeader(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

const ALIAS_INDEX: Record<CsvCanonicalField, Set<string>> = {
  descricao: new Set(CSV_HEADER_ALIASES.descricao.map(normalizeCsvHeader)),
  data: new Set(CSV_HEADER_ALIASES.data.map(normalizeCsvHeader)),
  valor: new Set(CSV_HEADER_ALIASES.valor.map(normalizeCsvHeader)),
};

type ExtractedCsvRow = Record<CsvCanonicalField, string>;

export function extractCanonicalCsvFields(row: Record<string, unknown>): ExtractedCsvRow {
  const extracted: ExtractedCsvRow = {
    descricao: "",
    data: "",
    valor: "",
  };

  for (const [rawKey, rawValue] of Object.entries(row || {})) {
    const normalizedKey = normalizeCsvHeader(rawKey);
    if (!normalizedKey) continue;

    const value = String(rawValue ?? "").trim();
    if (!value) continue;

    for (const field of Object.keys(ALIAS_INDEX) as CsvCanonicalField[]) {
      if (extracted[field]) continue;
      if (ALIAS_INDEX[field].has(normalizedKey)) {
        extracted[field] = value;
      }
    }
  }

  return extracted;
}
