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

export type PostImportPriorityAction = {
  text: string
  actionLabel: string
  actionHref: string
}

export type PostImportPriorityLimiter = {
  text: string
  actionLabel: string
  actionHref: string
} | null

export type PostImportPrioritiesSummary = {
  target: ResponsibleViewKey | "Periodo"
  primaryAttention: PostImportPriorityAction
  confidenceLimiter: PostImportPriorityLimiter
  nextAction: PostImportPriorityAction
  expectedConfidenceImpact: string
}

export type PostImportStrengtheningSummary = {
  level: "strengthened" | "partially_strengthened" | "limited"
  text: string
}

export type TopGenericDescription = {
  descricao: string
  valor: number
}

export type PostImportOperationalStatus = "ready" | "partial" | "needs_review" | "blocked"

export type PostImportReviewContext = {
  outrosRows: number
  outrosValue: number
  topGenericDescriptions: TopGenericDescription[]
  reviewHref: string | null
  ambiguousRows: number
  ambiguousValue: number
  ambiguousReviewHref: string | null
  periodSummary: PostImportPeriodSummary
  consolidatedSummary: PostImportConsolidatedSummary
  periodPriorities: PostImportPrioritiesSummary
  strengtheningSummary: PostImportStrengtheningSummary
  periodReviewHref: string
  periodLabel: string
  monthOperationalStatus: PostImportOperationalStatus
  monthOperationalReason: string
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
  if (totalConsumptionValue <= 0) {
    if (totalNonConsumptionValue > 0) return "non_consumption_dominant" as const
    return "insufficient_base" as const
  }

  // Se consumo for muito baixo (ex: uma coxinha no mes inteiro) nao da pra focar nisso
  if (totalConsumptionValue < 150) {
    return "insufficient_base" as const
  }

  // Se a movimentacao financeira esmagar o consumo, e o consumo em si for baixo
  if (totalConsumptionValue < 1000 && totalNonConsumptionValue > totalConsumptionValue * 2) {
    return "non_consumption_dominant" as const
  }

  return "consumption_focus" as const
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

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function resolvePriorityTarget(summary: PostImportConsolidatedSummary): PostImportResponsibleSummary | null {
  const casal = summary.views.find((view) => view.responsavel === "Casal") || null

  if (summary.coverage.status === "ready" && casal?.mode === "consumption_focus" && casal.attentionCategory) {
    return casal
  }

  const rankedConsumptionViews = summary.views
    .filter((view) => view.mode === "consumption_focus" && view.attentionCategory)
    .sort((a, b) => b.totalConsumptionValue - a.totalConsumptionValue)

  if (rankedConsumptionViews.length > 0) {
    return rankedConsumptionViews[0]
  }

  return casal || summary.views[0] || null
}

function isAmbiguityRelevant(view: PostImportResponsibleSummary): boolean {
  if (view.ambiguousRows <= 0 || view.ambiguousValue <= 0) return false

  if (view.totalConsumptionValue <= 0) {
    return view.ambiguousValue >= 200
  }

  const ratio = view.ambiguousValue / view.totalConsumptionValue
  return view.ambiguousValue >= 300 || ratio >= 0.12
}

function buildPrimaryAttention(
  targetView: PostImportResponsibleSummary | null,
  coverageStatus: PostImportCoverageSummary["status"],
  periodReviewHref: string
): PostImportPriorityAction {
  if (!targetView) {
    return {
      text: "Principal atencao: sem base suficiente para priorizar consumo real neste recorte.",
      actionLabel: "Abrir extrato do periodo",
      actionHref: periodReviewHref,
    }
  }

  if (targetView.mode === "consumption_focus" && targetView.attentionCategory) {
    const percent = (targetView.attentionPercent || 0).toFixed(1)
    const scopedLeadText =
      targetView.responsavel === "Casal" && coverageStatus === "ready"
        ? `Principal atencao: ${targetView.attentionCategory} lidera o consumo real do casal (${percent}%).`
        : `Principal atencao no recorte disponivel: ${targetView.attentionCategory} lidera em ${targetView.responsavel} (${percent}%).`

    return {
      text: scopedLeadText,
      actionLabel: `Auditar ${targetView.attentionCategory} no extrato`,
      actionHref: targetView.leaderReviewHref || targetView.periodReviewHref,
    }
  }

  if (targetView.mode === "non_consumption_dominant") {
    return {
      text: `Principal atencao: o periodo de ${targetView.responsavel} esta focado em nao-consumo (${formatCurrency(targetView.totalNonConsumptionValue)}).`,
      actionLabel: "Abrir extrato deste recorte",
      actionHref: targetView.periodReviewHref,
    }
  }

  return {
    text: `Principal atencao: ${targetView.responsavel} nao possui base representativa de consumo real.`,
    actionLabel: "Abrir extrato deste recorte",
    actionHref: targetView.periodReviewHref,
  }
}

function buildConfidenceLimiter(
  targetView: PostImportResponsibleSummary | null,
  summary: PostImportConsolidatedSummary,
  periodReviewHref: string
): PostImportPriorityLimiter {
  if (summary.coverage.status === "partial") {
    const missing = summary.coverage.missingForCouple.length > 0
      ? summary.coverage.missingForCouple.join(" e ")
      : "responsavel complementar"
    return {
      text: `Limitador principal: cobertura do casal parcial; falta importar ${missing} para consolidar a leitura conjunta.`,
      actionLabel: "Importar extrato faltante",
      actionHref: "/conciliacao",
    }
  }

  if (summary.coverage.status === "unknown") {
    return {
      text: "Limitador principal: cobertura do casal ainda nao confirmada neste recorte.",
      actionLabel: "Validar periodo no extrato",
      actionHref: periodReviewHref,
    }
  }

  if (!targetView) return null

  if (targetView.mode === "non_consumption_dominant") {
    return {
      text: `Limitador principal: predominio de nao-consumo (${formatCurrency(targetView.totalNonConsumptionValue)}) reduz confianca para conclusao de controle.`,
      actionLabel: "Revisar extrato do recorte",
      actionHref: targetView.periodReviewHref,
    }
  }

  if (isAmbiguityRelevant(targetView) && targetView.ambiguousReviewHref) {
    return {
      text: `Limitador principal: ${targetView.ambiguousRows} ambiguo(s) somando ${formatCurrency(targetView.ambiguousValue)} ainda podem alterar a leitura.`,
      actionLabel: "Revisar ambiguos de maior impacto",
      actionHref: targetView.ambiguousReviewHref,
    }
  }

  return null
}

function buildNextAction(
  targetView: PostImportResponsibleSummary | null,
  summary: PostImportConsolidatedSummary,
  periodReviewHref: string
): PostImportPriorityAction {
  if (summary.coverage.status === "partial") {
    const missing = summary.coverage.missingForCouple.length > 0
      ? summary.coverage.missingForCouple.join(" e ")
      : "responsavel complementar"
    return {
      text: `Proxima acao recomendada: importar ${missing} para completar a visao consolidada do casal neste periodo.`,
      actionLabel: "Importar extrato faltante",
      actionHref: "/conciliacao",
    }
  }

  if (summary.coverage.status === "unknown") {
    return {
      text: "Proxima acao recomendada: abrir o extrato do periodo para validar se todos os responsaveis relevantes ja foram importados.",
      actionLabel: "Abrir extrato do periodo",
      actionHref: periodReviewHref,
    }
  }

  if (targetView && isAmbiguityRelevant(targetView) && targetView.ambiguousReviewHref) {
    return {
      text: "Proxima acao recomendada: revisar primeiro os ambiguos de maior impacto para reduzir incerteza antes de sugerir controle.",
      actionLabel: "Revisar ambiguos de maior impacto",
      actionHref: targetView.ambiguousReviewHref,
    }
  }

  if (targetView?.leaderReviewHref && targetView.attentionCategory) {
    return {
      text: `Proxima acao recomendada: auditar os maiores lancamentos da lideranca em ${targetView.attentionCategory}.`,
      actionLabel: "Revisar lider no extrato",
      actionHref: targetView.leaderReviewHref,
    }
  }

  return {
    text: "Proxima acao recomendada: abrir o extrato deste recorte e validar os maiores valores antes de concluir controle.",
    actionLabel: "Abrir extrato deste recorte",
    actionHref: targetView?.periodReviewHref || periodReviewHref,
  }
}

function buildExpectedConfidenceImpact(
  targetView: PostImportResponsibleSummary | null,
  summary: PostImportConsolidatedSummary
): string {
  if (summary.coverage.status === "partial") {
    return "Concluir esta acao fortalece a visao do casal ao reduzir leitura parcial neste periodo."
  }

  if (summary.coverage.status === "unknown") {
    return "Concluir esta acao valida a cobertura do recorte e reduz o risco de interpretar um periodo incompleto."
  }

  if (targetView && isAmbiguityRelevant(targetView) && targetView.ambiguousReviewHref) {
    return "Concluir esta acao pode reduzir ambiguidade residual e deixar a prioridade do periodo mais confiavel."
  }

  if (targetView?.leaderReviewHref && targetView.attentionCategory) {
    return `Concluir esta acao ajuda a confirmar se ${targetView.attentionCategory} e a principal frente de atencao neste recorte.`
  }

  if (targetView?.mode === "non_consumption_dominant") {
    return "Concluir esta acao ajuda a separar movimentacao financeira de consumo real antes de sugerir controle."
  }

  return "Concluir esta acao melhora a validacao dos maiores valores e reduz leitura superficial do periodo."
}

function buildPeriodPriorities(
  summary: PostImportConsolidatedSummary,
  periodReviewHref: string
): PostImportPrioritiesSummary {
  const targetView = resolvePriorityTarget(summary)

  return {
    target: targetView?.responsavel || "Periodo",
    primaryAttention: buildPrimaryAttention(targetView, summary.coverage.status, periodReviewHref),
    confidenceLimiter: buildConfidenceLimiter(targetView, summary, periodReviewHref),
    nextAction: buildNextAction(targetView, summary, periodReviewHref),
    expectedConfidenceImpact: buildExpectedConfidenceImpact(targetView, summary),
  }
}

function coverageRank(status: PostImportCoverageSummary["status"]): number {
  if (status === "ready") return 2
  if (status === "partial") return 1
  return 0
}

function hasAmbiguityLimiter(limiter: PostImportPriorityLimiter): boolean {
  return Boolean(limiter?.actionHref.includes("review=ambiguous"))
}

function buildStrengtheningSummary(
  baselineSummary: PostImportConsolidatedSummary,
  currentSummary: PostImportConsolidatedSummary,
  baselinePriorities: PostImportPrioritiesSummary,
  currentPriorities: PostImportPrioritiesSummary,
  hasPeriodComparison: boolean
): PostImportStrengtheningSummary {
  if (!hasPeriodComparison) {
    return {
      level: "limited",
      text: "Ainda nao ha comparacao consolidada neste periodo; siga a proxima acao para fortalecer esta leitura.",
    }
  }

  const baselineCoverage = baselineSummary.coverage.status
  const currentCoverage = currentSummary.coverage.status

  if (coverageRank(currentCoverage) > coverageRank(baselineCoverage)) {
    if (currentCoverage === "ready") {
      return {
        level: "strengthened",
        text: "A leitura deste periodo ficou mais forte: a cobertura do casal agora esta pronta para consolidacao.",
      }
    }

    return {
      level: "partially_strengthened",
      text: "A leitura deste periodo ficou mais forte: a cobertura evoluiu, mas ainda nao esta completa para o casal.",
    }
  }

  if (baselinePriorities.confidenceLimiter && !currentPriorities.confidenceLimiter) {
    return {
      level: "strengthened",
      text: "A leitura deste periodo ficou mais forte: o principal limitador de confianca deixou de bloquear a prioridade.",
    }
  }

  if (hasAmbiguityLimiter(baselinePriorities.confidenceLimiter) && !hasAmbiguityLimiter(currentPriorities.confidenceLimiter)) {
    return {
      level: "partially_strengthened",
      text: "A leitura deste periodo ficou menos ambigua; a prioridade principal agora esta mais estavel.",
    }
  }

  if (baselinePriorities.target !== currentPriorities.target && currentPriorities.target === "Casal") {
    return {
      level: "partially_strengthened",
      text: "A prioridade migrou para a visao do casal neste periodo, com leitura mais consolidada que no lote isolado.",
    }
  }

  return {
    level: "limited",
    text: "A leitura segue cautelosa neste periodo; a melhoria depende de concluir a proxima acao auditavel.",
  }
}

export function buildPostImportReviewContext(
  rows: PostImportReviewRow[],
  periodRows?: PostImportReviewRow[]
): PostImportReviewContext {
  const period = resolveImportPeriod(rows)
  const baselineSummary = buildConsolidatedSummary(rows, period.month, period.year)
  const baselinePriorities = buildPeriodPriorities(baselineSummary, period.periodReviewHref)
  const sourceRows = getSummarySourceRows(rows, periodRows)
  const periodSummary = buildPeriodSummary(sourceRows, period.month, period.year)
  const consolidatedSummary = buildConsolidatedSummary(sourceRows, period.month, period.year)
  const periodPriorities = buildPeriodPriorities(consolidatedSummary, period.periodReviewHref)
  const strengtheningSummary = buildStrengtheningSummary(
    baselineSummary,
    consolidatedSummary,
    baselinePriorities,
    periodPriorities,
    Boolean(periodRows && periodRows.length > 0)
  )
  const outrosRows = rows.filter((row) => isGenericCategory(row.categoria)).length
  const outrosValue = rows
    .filter((row) => isGenericCategory(row.categoria))
    .reduce((acc, row) => acc + (Number(row.valor) || 0), 0)
    
  const genericDescMap = new Map<string, number>()
  for (const row of rows.filter(r => isGenericCategory(r.categoria))) {
    const desc = row.descricao || "Sem descricao"
    genericDescMap.set(desc, (genericDescMap.get(desc) || 0) + (Number(row.valor) || 0))
  }
  const topGenericDescriptions = Array.from(genericDescMap.entries())
    .map(([descricao, valor]) => ({ descricao, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 3)

  const ambiguousRows = rows.filter((row) => isAmbiguousReviewCandidate(row)).length
  const ambiguousValue = rows
    .filter((row) => isAmbiguousReviewCandidate(row))
    .reduce((acc, row) => acc + (Number(row.valor) || 0), 0)
  const ambiguousReviewHref =
    ambiguousRows > 0
      ? `/transacoes?month=${period.month}&year=${period.year}&review=ambiguous&sort=value_desc`
      : null

  const casalView = consolidatedSummary.views.find((v) => v.responsavel === "Casal")
  let monthOperationalStatus: PostImportOperationalStatus = "ready"
  let monthOperationalReason = "Fechamento legivel e seguro para analise."

  if (consolidatedSummary.coverage.status === "unknown") {
    monthOperationalStatus = "blocked"
    monthOperationalReason = "Base vazia ou sem importacoes confirmadas neste recorte. Inicie a importacao."
  } else if (consolidatedSummary.coverage.status === "partial") {
    monthOperationalStatus = "partial"
    const missing = consolidatedSummary.coverage.missingForCouple.join(" e ")
    monthOperationalReason = `Falta importar o extrato de ${missing} para concluir o mes.`
  } else if (periodPriorities.confidenceLimiter) {
    monthOperationalStatus = "needs_review"
    monthOperationalReason = periodPriorities.confidenceLimiter.text
  } else if (casalView && casalView.mode !== "consumption_focus") {
    monthOperationalStatus = "needs_review"
    monthOperationalReason = `A visao de casal nao esta focada em consumo (${casalView.mode}).`
  } else if (outrosValue >= 200 && casalView && outrosValue >= casalView.totalConsumptionValue * 0.1) {
    monthOperationalStatus = "needs_review"
    monthOperationalReason = "Excesso critico de lancamentos listados como 'Outros' ou 'Sem categoria'."
  }

  if (outrosRows === 0) {
    return {
      outrosRows: 0,
      outrosValue: 0,
      topGenericDescriptions: [],
      reviewHref: null,
      ambiguousRows,
      ambiguousValue,
      ambiguousReviewHref,
      periodSummary,
      consolidatedSummary,
      periodPriorities,
      strengtheningSummary,
      periodReviewHref: period.periodReviewHref,
      periodLabel: period.periodLabel,
      monthOperationalStatus,
      monthOperationalReason,
    }
  }

  return {
    outrosRows,
    outrosValue,
    topGenericDescriptions,
    reviewHref: `/transacoes?month=${period.month}&year=${period.year}&category=Outros&sort=value_desc`,
    ambiguousRows,
    ambiguousValue,
    ambiguousReviewHref,
    periodSummary,
    consolidatedSummary,
    periodPriorities,
    strengtheningSummary,
    periodReviewHref: period.periodReviewHref,
    periodLabel: period.periodLabel,
    monthOperationalStatus,
    monthOperationalReason,
  }
}
