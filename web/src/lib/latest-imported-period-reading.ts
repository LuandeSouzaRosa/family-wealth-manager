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
  }
}

