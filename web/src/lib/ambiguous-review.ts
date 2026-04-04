export type AmbiguousReviewCandidate = {
  categoria?: string | null
  descricao?: string | null
  tipo?: string | null
  valor?: number | string | null
}

const GENERIC_PIX_PREFIXES = [
  "pix",
  "pix enviado",
  "pix receb",
  "pix transferencia",
  "pix pagamento",
  "pix agendado",
  "transferencia pix",
  "pagamento pix",
  "transferencia via pix",
]

export function normalizeToken(value: string | null | undefined): string {
  return (value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

export function isGenericCategory(value: string | null | undefined): boolean {
  const normalized = normalizeToken(value)
  return normalized === "outros" || normalized === "sem categoria"
}

export function isGenericPixDescription(value: string | null | undefined): boolean {
  const normalized = normalizeToken(value)
  if (!normalized || !normalized.includes("pix")) return false

  return GENERIC_PIX_PREFIXES.some((prefix) =>
    normalized === prefix || normalized.startsWith(`${prefix} `)
  )
}

function isExpenseType(value: string | null | undefined): boolean {
  const normalized = normalizeToken(value)
  if (!normalized) return true
  return normalized === "saida"
}

function normalizeMoney(value: number | string | null | undefined): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return parsed
}

export function isAmbiguousReviewCandidate(row: AmbiguousReviewCandidate): boolean {
  if (!isExpenseType(row.tipo)) return false
  if (normalizeMoney(row.valor) <= 0) return false

  return isGenericCategory(row.categoria) || isGenericPixDescription(row.descricao)
}

