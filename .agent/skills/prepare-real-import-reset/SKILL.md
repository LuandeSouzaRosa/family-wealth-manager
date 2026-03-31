---
name: prepare-real-import-reset
description: Use when the user asks to reset the financial operational base before a real CSV import cycle, with safety snapshot and preservation of categorization/config data.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Prepare Real Import Reset (FWM)

Use this skill for a **safe reset** before starting real data import cycles.

## Scope
- Reset only what is needed to zero financial reading.
- Preserve categorization rules and config structures.
- Produce explicit evidence of what was cleaned vs preserved.

## FWM Safety Contract
- Never treat FWM as greenfield.
- Preserve `regras_categorizacao` always.
- Preserve config entities unless explicitly requested otherwise:
  - `categorias`
  - `contas_bancarias`
  - `orcamentos`
  - `metas`
  - `recorrentes`
- Default clean target: `transacoes` for the selected user.

## Default Workflow
1. Confirm target user email (`--email` or `TEST_EMAIL`).
2. Run safe preview first:
   - `npm run ops:prepare-real-import-reset -- --dry-run --email <email>`
3. Run safe reset script with explicit confirmation:
   - `npm run ops:prepare-real-import-reset -- --confirm --email <email>`
4. Check output:
   - snapshot path under `web/.tmp-ops/`
   - before/after transaction counts
   - preserved tables unchanged
   - `regras_categorizacao` integrity hash unchanged
5. Run real import via UI (same product path, no direct DB injection):
   - `npm run ops:real-import-ui -- --file <csv-path> --email <email>`
6. Report with evidence labels:
   - implemented in code
   - proven by local runtime (if script executed)
   - not proven yet (for any skipped step)

## Script Used
- `web/scripts/prepare-real-import-reset.js`
- `web/scripts/real-import-ui.js`

## Notes
- This workflow is destructive for `transacoes`.
- If `--confirm` is missing (and `--dry-run` is not set), the script must fail by design.
