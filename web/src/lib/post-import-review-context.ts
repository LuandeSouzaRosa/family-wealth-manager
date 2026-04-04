import { isAmbiguousReviewCandidate, isGenericCategory, normalizeToken } from "./ambiguous-review"
import { buildSpendingClaritySnapshot } from "./spending-clarity"

export type PostImportReviewRow = {
  categoria?: string | null
  descricao?: string | null
  responsavel?: string | null
  tipo?: string | null
  status?: string | null
  origem?: string | null
  valor?: number | null
  data?: string | null
}

type ResponsibleViewKey = "Luan" | "Luana" | "Casal"
const RESPONSIBLE_VIEWS: ResponsibleViewKey[] = ["Luan", "Luana", "Casal"]

export type PostImportTopConsumptionCategory = {
  categoria: string
  total: number
  percentual: number
  lancamentos: number
  reviewHref: string
}

export type PostImportPeriodSummary = {
  mode: "consumption_focus" | "non_consumption_dominant" | "insufficient_base"
  totalConsumptionValue: number
  totalNonConsumptionValue: number
  topConsumptionCategories: PostImportTopConsumptionCategory[]
  attentionCategory: string | null
  attentionPercent: number | null
  leaderReviewHref: string | null
}

export type PostImportResponsibleSummary = {
  responsavel: ResponsibleViewKey
  mode: "consumption_focus" | "non_consumption_dominant" | "insufficient_base"
  totalConsumptionValue: number
  totalNonConsumptionValue: number
  topConsumptionCategories: PostImportTopConsumptionCategory[]
  attentionCategory: string | null
  attentionPercent: number | null
  ambiguousRows: number
  ambiguousValue: number
  periodReviewHref: string
  leaderReviewHref: string | null
  ambiguousReviewHref: string | null
}

export type PostImportCoverageSummary = {
  importedResponsaveis: ResponsibleViewKey[]
  status: "ready" | "partial" | "unknown"
  missingForCouple: Array<"Luan" | "Luana">
}

export type PostImportConsolidatedSummary = {
  coverage: PostImportCoverageSummary
  views: PostImportResponsibleSummary[]
}

export type PostImportReviewContext = {
  outrosRows: number
  outrosValue: number
  reviewHref: string | null
  ambiguousRows: number
  ambiguousValue: number
  ambiguousReviewHref: string | null
  periodSummary: PostImportPeriodSummary
  consolidatedSummary: PostImportConsolidatedSummary
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

function getSummarySourceRows(rows: PostImportReviewRow[], periodRows?: PostImportReviewRow[]): PostImportReviewRow[] {
  return periodRows && periodRows.length > 0 ? periodRows : rows
}

function normalizeResponsavel(value: string | null | undefined): ResponsibleViewKey | null {
  const normalized = normalizeToken(value)
  if (normalized === "luan") return "Luan"
  if (normalized === "luana") return "Luana"
  if (normalized === "casal") return "Casal"
  return null
}

function isRowForResponsavel(row: PostImportReviewRow, responsavel: ResponsibleViewKey): boolean {
  return normalizeResponsavel(row.responsavel) === responsavel
}

function buildCategoryReviewHref(month: string, year: string, category: string, responsavel?: ResponsibleViewKey): string {
  const params = new URLSearchParams()
  params.set("month", month)
  params.set("year", year)
  params.set("category", category)
  params.set("sort", "value_desc")
  if (responsavel) params.set("responsavel", responsavel)
  return `/transacoes?${params.toString()}`
}

function buildPeriodReviewHref(month: string, year: string, responsavel?: ResponsibleViewKey): string {
  const params = new URLSearchParams()
  params.set("month", month)
  params.set("year", year)
  params.set("sort", "value_desc")
  if (responsavel) params.set("responsavel", responsavel)
  return `/transacoes?${params.toString()}`
}

function buildAmbiguousReviewHref(month: string, year: string, responsavel?: ResponsibleViewKey): string {
  const params = new URLSearchParams()
  params.set("month", month)
  params.set("year", year)
  params.set("review", "ambiguous")
  params.set("sort", "value_desc")
  if (responsavel) params.set("responsavel", responsavel)
  return `/transacoes?${params.toString()}`
}

function resolveViewMode(totalConsumptionValue: number, totalNonConsumptionValue: number) {
  if (totalConsumptionValue > 0) return "consumption_focus" as const
  if (totalNonConsumptionValue > 0) return "non_consumption_dominant" as const
  return "insufficient_base" as const
}

function buildPeriodSummary(sourceRows: PostImportReviewRow[], month: string, year: string): PostImportPeriodSummary {
  const snapshot = buildSpendingClaritySnapshot(
    sourceRows.map((row) => ({
      valor: Number(row.valor) || 0,
      tipo: row.tipo || "Saida",
      categoria: row.categoria || "Sem categoria",
      responsavel: row.responsavel || "Casal",
      status: row.status || null,
    })),
    []
  ).Todos

  const topConsumptionCategories = snapshot.topCategorias.map((item) => ({
    categoria: item.categoria,
    total: item.total,
    percentual: item.percentual,
    lancamentos: item.lancamentos,
    reviewHref: buildCategoryReviewHref(month, year, item.categoria),
  }))

  const totalConsumptionValue = Number(snapshot.totalSaidasRealizadas || 0)
  const totalNonConsumptionValue = Number(snapshot.totalSaidasDesconsideradas || 0)
  const leader = topConsumptionCategories[0] || null

  return {
    mode: resolveViewMode(totalConsumptionValue, totalNonConsumptionValue),
    totalConsumptionValue,
    totalNonConsumptionValue,
    topConsumptionCategories,
    attentionCategory: leader?.categoria || null,
    attentionPercent: leader?.percentual ?? null,
    leaderReviewHref: leader?.reviewHref || null,
  }
}

function buildCoverageSummary(sourceRows: PostImportReviewRow[]): PostImportCoverageSummary {
  const importedResponsaveisSet = new Set<ResponsibleViewKey>()
  for (const row of sourceRows) {
    const origem = normalizeToken(row.origem)
    if (!origem.includes("import")) continue
    const responsavel = normalizeResponsavel(row.responsavel)
    if (responsavel) importedResponsaveisSet.add(responsavel)
  }

  const importedResponsaveis = Array.from(importedResponsaveisSet)
  const hasCasal = importedResponsaveisSet.has("Casal")
  const hasLuan = importedResponsaveisSet.has("Luan")
  const hasLuana = importedResponsaveisSet.has("Luana")
  const missingForCouple: Array<"Luan" | "Luana"> = []

  if (!hasCasal) {
    if (!hasLuan) missingForCouple.push("Luan")
    if (!hasLuana) missingForCouple.push("Luana")
  }

  const status: PostImportCoverageSummary["status"] =
    hasCasal || (hasLuan && hasLuana) ? "ready" : hasLuan || hasLuana ? "partial" : "unknown"

  return {
    importedResponsaveis,
    status,
    missingForCouple,
  }
}

function buildResponsibleSummary(
  sourceRows: PostImportReviewRow[],
  month: string,
  year: string
): PostImportResponsibleSummary[] {
  const snapshot = buildSpendingClaritySnapshot(
    sourceRows.map((row) => ({
      valor: Number(row.valor) || 0,
      tipo: row.tipo || "Saida",
      categoria: row.categoria || "Sem categoria",
      responsavel: row.responsavel || "Casal",
      status: row.status || null,
    })),
    []
  )

  return RESPONSIBLE_VIEWS.map((responsavel) => {
    const view = snapshot[responsavel]
    const totalConsumptionValue = Number(view.totalSaidasRealizadas || 0)
    const totalNonConsumptionValue = Number(view.totalSaidasDesconsideradas || 0)
    const topConsumptionCategories = view.topCategorias.map((item) => ({
      categoria: item.categoria,
      total: item.total,
      percentual: item.percentual,
      lancamentos: item.lancamentos,
      reviewHref: buildCategoryReviewHref(month, year, item.categoria, responsavel),
    }))
    const leader = topConsumptionCategories[0] || null

    const ambiguousRows = sourceRows.filter(
      (row) => isRowForResponsavel(row, responsavel) && isAmbiguousReviewCandidate(row)
    ).length
    const ambiguousValue = sourceRows
      .filter((row) => isRowForResponsavel(row, responsavel) && isAmbiguousReviewCandidate(row))
      .reduce((acc, row) => acc + (Number(row.valor) || 0), 0)

    return {
      responsavel,
      mode: resolveViewMode(totalConsumptionValue, totalNonConsumptionValue),
      totalConsumptionValue,
      totalNonConsumptionValue,
      topConsumptionCategories,
      attentionCategory: leader?.categoria || null,
      attentionPercent: leader?.percentual ?? null,
      ambiguousRows,
      ambiguousValue,
      periodReviewHref: buildPeriodReviewHref(month, year, responsavel),
      leaderReviewHref: leader?.reviewHref || null,
      ambiguousReviewHref:
        ambiguousRows > 0 ? buildAmbiguousReviewHref(month, year, responsavel) : null,
    }
  })
}

function buildConsolidatedSummary(
  sourceRows: PostImportReviewRow[],
  month: string,
  year: string
): PostImportConsolidatedSummary {
  return {
    coverage: buildCoverageSummary(sourceRows),
    views: buildResponsibleSummary(sourceRows, month, year),
  }
}

export function buildPostImportReviewContext(
  rows: PostImportReviewRow[],
  periodRows?: PostImportReviewRow[]
): PostImportReviewContext {
  const period = resolveImportPeriod(rows)
  const sourceRows = getSummarySourceRows(rows, periodRows)
  const periodSummary = buildPeriodSummary(sourceRows, period.month, period.year)
  const consolidatedSummary = buildConsolidatedSummary(sourceRows, period.month, period.year)
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
      periodSummary,
      consolidatedSummary,
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
    periodSummary,
    consolidatedSummary,
    periodReviewHref: period.periodReviewHref,
    periodLabel: period.periodLabel,
  }
}

