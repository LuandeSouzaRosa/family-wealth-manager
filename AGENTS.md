# Family Wealth Manager (FWM) - Agent Guidance

## 1) Project Identity (existing system, not greenfield)
- This repository is an existing production-like system in internal beta.
- Do not treat FWM as a new project.
- Do not reopen consolidated decisions without strong technical evidence.
- `/docs` is canonical documentation, but real code is the source of truth when they diverge.

## 2) Mandatory Evidence Language
Always classify findings and outcomes explicitly as one of:
- `implemented in code`
- `audited by inspection`
- `partially validated`
- `proven by automated test`
- `proven by local runtime`
- `not proven yet`

Never claim robustness from build alone. Never claim runtime proof from inspection alone.

## 3) Priority Order
1. Financial truth
2. Cross-screen coherence
3. Operational robustness
4. Low daily friction
5. Small, surgical scope

## 4) Consolidated Stack and Rules
- Next.js App Router, React, TypeScript strict
- Supabase/PostgreSQL
- Server Actions
- Tailwind + Shadcn UI
- Zod
- Vercel

Project rules:
- Use `invalidateTag(CACHE_TAGS.dashboard)` whenever dashboard metrics are impacted.
- Use granular `revalidatePath`; never global invalidation.
- CSV-first is primary ingestion strategy.
- Quick Add / Manual flows are secondary and stable.
- Splits are real transaction rows grouped by `split_group_id`.
- Pluggy/Open Finance is currently out of scope.

## 5) Reset / Data Cleaning Policy (critical)
When preparing a clean base for real import cycles:
- Preserve categorization rules (`regras_categorizacao`) always.
- Preserve structure/config tables that are not required to zero financial reading.
- By default, only clear operational financial rows required for clean reading (mainly `transacoes`).
- Produce a snapshot before destructive operations.
- Validate post-clean state and report with explicit evidence level.

## 6) Workflow Skills (repo-local)
Use repo-local skills under `.agent/skills/`:
- `prepare-real-import-reset`
- `analyze-bank-statement-import`
- `post-import-validation`

When these workflows are requested, follow their `SKILL.md` and use provided scripts in `web/scripts/`.

## 7) Operational Commands (short form)
Run in `web/`:
- `npm run ops:prepare-real-import-reset -- --confirm`
- `npm run ops:analyze-bank-statement-import -- --file <path-to-csv>`
- `npm run ops:real-import-ui -- --file <path-to-csv>`
- `npm run ops:post-import-validation`

## 8) Scope Discipline
- Prefer fixing baseline truth/coherence before adding new feature surface.
- Avoid broad refactors in this repo unless explicitly requested.
- Keep interventions reversible and easy to audit.
