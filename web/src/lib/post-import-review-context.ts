export type PostImportReviewRow = {
  categoria?: string | null
  valor?: number | null
  data?: string | null
}

export type PostImportReviewContext = {
  outrosRows: number
  outrosValue: number
  reviewHref: string | null
  periodReviewHref: string
  periodLabel: string
}

function normalizeToken(value: string | null | undefined): string {
  return (value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function isGenericCategory(value: string | null | undefined): boolean {
  const normalized = normalizeToken(value)
  return normalized === "outros" || normalized === "sem categoria"
}

function resolveImportPeriod(rows: PostImportReviewRow[]) {
  const parsedDates = rows
    .map((row) => new Date(row.data || ""))
    .filter((date) => !Number.isNaN(date.getTime()))

  if (parsedDates.length === 0) {
    return {
      month: "0",
      year: "0",
      periodReviewHref: "/transacoes?month=0&year=0&sort=value_desc",
      periodLabel: "todos os anos",
    }
  }

  const monthYearSet = new Set(parsedDates.map((date) => `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`))
  const yearsSet = new Set(parsedDates.map((date) => date.getUTCFullYear()))

  let month = "0"
  let year = "0"

  if (monthYearSet.size === 1) {
    const firstDate = parsedDates[0]
    month = String(firstDate.getUTCMonth() + 1)
    year = String(firstDate.getUTCFullYear())
  } else if (yearsSet.size === 1) {
    year = String(parsedDates[0].getUTCFullYear())
  }

  const periodLabel =
    month !== "0" ? `${month.padStart(2, "0")}/${year}` : year !== "0" ? `ano ${year}` : "todos os anos"

  return {
    month,
    year,
    periodReviewHref: `/transacoes?month=${month}&year=${year}&sort=value_desc`,
    periodLabel,
  }
}

export function buildPostImportReviewContext(rows: PostImportReviewRow[]): PostImportReviewContext {
  const period = resolveImportPeriod(rows)
  const outrosRows = rows.filter((row) => isGenericCategory(row.categoria)).length
  const outrosValue = rows
    .filter((row) => isGenericCategory(row.categoria))
    .reduce((acc, row) => acc + (Number(row.valor) || 0), 0)

  if (outrosRows === 0) {
    return {
      outrosRows: 0,
      outrosValue: 0,
      reviewHref: null,
      periodReviewHref: period.periodReviewHref,
      periodLabel: period.periodLabel,
    }
  }

  return {
    outrosRows,
    outrosValue,
    reviewHref: `/transacoes?month=${period.month}&year=${period.year}&category=Outros&sort=value_desc`,
    periodReviewHref: period.periodReviewHref,
    periodLabel: period.periodLabel,
  }
}
