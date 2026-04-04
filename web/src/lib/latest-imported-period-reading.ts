import { normalizeToken } from "./ambiguous-review"
import { buildPostImportReviewContext, PostImportReviewRow } from "./post-import-review-context"

export type LatestImportedPeriodReading = {
  periodLabel: string
  periodReviewHref: string
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

export function buildLatestImportedPeriodReading(
  periodRows: PostImportReviewRow[]
): LatestImportedPeriodReading | null {
  if (!periodRows || periodRows.length === 0) return null

  const importedRows = periodRows.filter((row) => isImportedOrigin(row.origem))
  if (importedRows.length === 0) return null

  const context = buildPostImportReviewContext(importedRows, periodRows)
  const limiter = context.periodPriorities.confidenceLimiter
  const strengtheningLevel = context.strengtheningSummary.level

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
