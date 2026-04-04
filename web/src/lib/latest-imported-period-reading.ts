import { normalizeToken } from "./ambiguous-review"
import { buildPostImportReviewContext, PostImportReviewRow } from "./post-import-review-context"

export type LatestImportedReadingTargetScope = "Luan" | "Luana" | "Casal" | "Periodo"
export type ExtratoResponsavelFilter = "Todos" | "Luan" | "Luana" | "Casal"
export type LatestReadingAlignmentStatus = "aligned" | "partially_aligned" | "outside_scope"

export type LatestReadingContextAlignment = {
  status: LatestReadingAlignmentStatus
  text: string
  ctaLabel: string | null
  ctaHref: string | null
}

export type LatestImportedPeriodReading = {
  periodLabel: string
  periodReviewHref: string
  targetScope: LatestImportedReadingTargetScope
  temporalSummary: {
    periodReference: string
    recencyHint: string
    periodStatus: "ongoing" | "closed"
    periodStatusText: string
    lastImportedTransactionDate: string | null
  }
  primaryAttentionText: string
  confidenceLimiterText: string | null
  nextActionText: string
  nextActionLabel: string
  nextActionHref: string
  expectedConfidenceImpact: string
  strengtheningText: string
  pendingSummary: {
    status: "active" | "reduced" | "resolved" | "no_relevant"
    text: string
    actionLabel: string
    actionHref: string
  }
}

export function isImportedOrigin(origem: string | null | undefined): boolean {
  return normalizeToken(origem).includes("import")
}

function parseReadingPeriodHref(href: string): { month: string; year: string } {
  const query = href.split("?")[1] || ""
  const params = new URLSearchParams(query)
  return {
    month: params.get("month") || "0",
    year: params.get("year") || "0",
  }
}

function buildReadingScopeHref(reading: LatestImportedPeriodReading): string {
  if (reading.targetScope === "Periodo") return reading.periodReviewHref

  const [path, query = ""] = reading.periodReviewHref.split("?")
  const params = new URLSearchParams(query)
  params.set("responsavel", reading.targetScope)
  return `${path}?${params.toString()}`
}

function formatScope(value: ExtratoResponsavelFilter | LatestImportedReadingTargetScope): string {
  return value === "Periodo" ? "periodo importado" : value
}

export function resolveLatestReadingContextAlignment(
  reading: LatestImportedPeriodReading,
  currentFilters: {
    month: string
    year: string
    responsavel: ExtratoResponsavelFilter
  }
): LatestReadingContextAlignment {
  const readingPeriod = parseReadingPeriodHref(reading.periodReviewHref)
  const samePeriod = readingPeriod.month === currentFilters.month && readingPeriod.year === currentFilters.year
  const scopedHref = buildReadingScopeHref(reading)

  if (!samePeriod) {
    return {
      status: "outside_scope",
      text: "Leitura do ultimo periodo importado fora do recorte atual de mes/ano.",
      ctaLabel: "Voltar para o recorte da leitura",
      ctaHref: scopedHref,
    }
  }

  if (reading.targetScope === "Periodo") {
    if (currentFilters.responsavel === "Todos") {
      return {
        status: "aligned",
        text: "Leitura alinhada ao recorte atual de periodo e responsavel.",
        ctaLabel: null,
        ctaHref: null,
      }
    }

    return {
      status: "partially_aligned",
      text: `Leitura no mesmo periodo, mas o filtro atual esta focado em ${formatScope(currentFilters.responsavel)}.`,
      ctaLabel: "Ver leitura no periodo completo",
      ctaHref: reading.periodReviewHref,
    }
  }

  if (currentFilters.responsavel === reading.targetScope) {
    return {
      status: "aligned",
      text: "Leitura alinhada ao recorte atual de periodo e responsavel.",
      ctaLabel: null,
      ctaHref: null,
    }
  }

  return {
    status: "partially_aligned",
    text: `Leitura no mesmo periodo, mas focada em ${formatScope(reading.targetScope)}; recorte atual em ${formatScope(currentFilters.responsavel)}.`,
    ctaLabel: "Abrir recorte da leitura",
    ctaHref: scopedHref,
  }
}

function formatDatePtBr(value: Date): string {
  const day = String(value.getUTCDate()).padStart(2, "0")
  const month = String(value.getUTCMonth() + 1).padStart(2, "0")
  const year = String(value.getUTCFullYear())
  return `${day}/${month}/${year}`
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function buildTemporalSummary(
  importedRows: PostImportReviewRow[],
  periodLabel: string,
  referenceDate: Date
): LatestImportedPeriodReading["temporalSummary"] {
  const importedDates = importedRows
    .map((row) => new Date(row.data || ""))
    .filter((date) => !Number.isNaN(date.getTime()))

  if (importedDates.length === 0) {
    return {
      periodReference: periodLabel,
      recencyHint: "Leitura mais recente disponivel para o ultimo periodo importado.",
      periodStatus: "closed",
      periodStatusText: "Sem data importada valida para definir se o periodo esta em andamento.",
      lastImportedTransactionDate: null,
    }
  }

  const latestImportedDate = importedDates.reduce((latest, current) =>
    current.getTime() > latest.getTime() ? current : latest
  )

  const isOngoing =
    latestImportedDate.getUTCFullYear() === referenceDate.getUTCFullYear() &&
    latestImportedDate.getUTCMonth() === referenceDate.getUTCMonth()

  const dayDiff = Math.floor(
    (startOfDay(referenceDate).getTime() - startOfDay(latestImportedDate).getTime()) / (1000 * 60 * 60 * 24)
  )

  const recencyHint =
    dayDiff <= 10
      ? "Leitura mais recente disponivel para este periodo importado."
      : dayDiff <= 45
        ? "Leitura recente para este periodo importado, mas vale validar novos lancamentos."
        : "Leitura do ultimo periodo importado; pode haver defasagem para o contexto atual."

  return {
    periodReference: periodLabel,
    recencyHint,
    periodStatus: isOngoing ? "ongoing" : "closed",
    periodStatusText: isOngoing
      ? "Periodo em andamento."
      : "Periodo ja encerrado no calendario.",
    lastImportedTransactionDate: formatDatePtBr(latestImportedDate),
  }
}

export function buildLatestImportedPeriodReading(
  periodRows: PostImportReviewRow[],
  referenceDate: Date = new Date()
): LatestImportedPeriodReading | null {
  if (!periodRows || periodRows.length === 0) return null

  const importedRows = periodRows.filter((row) => isImportedOrigin(row.origem))
  if (importedRows.length === 0) return null

  const context = buildPostImportReviewContext(importedRows, periodRows)
  const limiter = context.periodPriorities.confidenceLimiter
  const strengtheningLevel = context.strengtheningSummary.level
  const temporalSummary = buildTemporalSummary(importedRows, context.periodLabel, referenceDate)

  const pendingSummary =
    limiter
      ? {
          status: strengtheningLevel === "partially_strengthened" ? "reduced" as const : "active" as const,
          text:
            strengtheningLevel === "partially_strengthened"
              ? `Pendencia principal deste periodo: ${limiter.text} Essa pendencia perdeu forca, mas ainda limita esta leitura.`
              : `Pendencia principal deste periodo: ${limiter.text} Ainda limita esta leitura.`,
          actionLabel: limiter.actionLabel,
          actionHref: limiter.actionHref,
        }
      : strengtheningLevel === "strengthened"
        ? {
            status: "resolved" as const,
            text: "A pendencia principal anterior foi destravada; a leitura atual esta mais estavel para auditoria.",
            actionLabel: context.periodPriorities.nextAction.actionLabel,
            actionHref: context.periodPriorities.nextAction.actionHref,
          }
        : {
            status: "no_relevant" as const,
            text: "Nao ha pendencia forte alem da auditoria normal dos maiores lancamentos neste periodo.",
            actionLabel: context.periodPriorities.nextAction.actionLabel,
            actionHref: context.periodPriorities.nextAction.actionHref,
          }

  return {
    periodLabel: context.periodLabel,
    periodReviewHref: context.periodReviewHref,
    targetScope: context.periodPriorities.target,
    temporalSummary,
    primaryAttentionText: context.periodPriorities.primaryAttention.text,
    confidenceLimiterText: context.periodPriorities.confidenceLimiter?.text || null,
    nextActionText: context.periodPriorities.nextAction.text,
    nextActionLabel: context.periodPriorities.nextAction.actionLabel,
    nextActionHref: context.periodPriorities.nextAction.actionHref,
    expectedConfidenceImpact: context.periodPriorities.expectedConfidenceImpact,
    strengtheningText: context.strengtheningSummary.text,
    pendingSummary,
  }
}
