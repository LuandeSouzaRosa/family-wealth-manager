export type PostImportReviewRow = {
  categoria?: string | null
  valor?: number | null
  data?: string | null
}

export type PostImportReviewContext = {
  outrosRows: number
  outrosValue: number
  reviewHref: string | null
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

export function buildPostImportReviewContext(rows: PostImportReviewRow[]): PostImportReviewContext {
  const outrosRows = rows.filter((row) => isGenericCategory(row.categoria)).length
  const outrosValue = rows
    .filter((row) => isGenericCategory(row.categoria))
    .reduce((acc, row) => acc + (Number(row.valor) || 0), 0)

  if (outrosRows === 0) {
    return {
      outrosRows: 0,
      outrosValue: 0,
      reviewHref: null,
    }
  }

  const parsedDates = rows
    .map((row) => new Date(row.data || ""))
    .filter((date) => !Number.isNaN(date.getTime()))

  if (parsedDates.length === 0) {
    return {
      outrosRows,
      outrosValue,
      reviewHref: "/transacoes?month=0&year=0&category=Outros&sort=value_desc",
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

  return {
    outrosRows,
    outrosValue,
    reviewHref: `/transacoes?month=${month}&year=${year}&category=Outros&sort=value_desc`,
  }
}
