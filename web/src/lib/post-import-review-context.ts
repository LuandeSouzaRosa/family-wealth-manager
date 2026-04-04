import { isAmbiguousReviewCandidate, isGenericCategory } from "./ambiguous-review"

export type PostImportReviewRow = {
  categoria?: string | null
  descricao?: string | null
  tipo?: string | null
  valor?: number | null
  data?: string | null
}

export type PostImportReviewContext = {
  outrosRows: number
  outrosValue: number
  reviewHref: string | null
  ambiguousRows: number
  ambiguousValue: number
  ambiguousReviewHref: string | null
  periodReviewHref: string
  periodLabel: string
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
  const ambiguousRows = rows.filter((row) => isAmbiguousReviewCandidate(row)).length
  const ambiguousValue = rows
    .filter((row) => isAmbiguousReviewCandidate(row))
    .reduce((acc, row) => acc + (Number(row.valor) || 0), 0)
  const ambiguousReviewHref =
    ambiguousRows > 0
      ? `/transacoes?month=${period.month}&year=${period.year}&review=ambiguous&sort=value_desc`
      : null

  if (outrosRows === 0) {
    return {
      outrosRows: 0,
      outrosValue: 0,
      reviewHref: null,
      ambiguousRows,
      ambiguousValue,
      ambiguousReviewHref,
      periodReviewHref: period.periodReviewHref,
      periodLabel: period.periodLabel,
    }
  }

  return {
    outrosRows,
    outrosValue,
    reviewHref: `/transacoes?month=${period.month}&year=${period.year}&category=Outros&sort=value_desc`,
    ambiguousRows,
    ambiguousValue,
    ambiguousReviewHref,
    periodReviewHref: period.periodReviewHref,
    periodLabel: period.periodLabel,
  }
}

