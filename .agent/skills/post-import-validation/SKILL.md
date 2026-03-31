---
name: post-import-validation
description: Use after CSV import to validate whether extrato/dashboard reading is useful and coherent, with explicit focus on generic category concentration and insight quality.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Post Import Validation (FWM)

Use this skill after import to validate practical reading quality.

## Validation Targets
- Import reflected in transaction base (extrato side).
- Dashboard has real expense base in same month.
- Spending clarity is not weak due to generic category concentration.
- Risk is explicit when insights are still limited.

## Default Workflow
1. Run:
   - `npm run ops:post-import-validation -- --email <email> --year <YYYY> --month <MM>`
   - If year/month omitted, current month is used.
2. Read report:
   - `web/.tmp-ops/post-import-validation-*.json`
3. Summarize:
   - imported rows in month
   - realized expense base
   - generic row/value share
   - clarity risk (`baixo|medio|alto`)
   - top categories and generic descriptions

## Script Used
- `web/scripts/post-import-validation.js`

## Interpretation Guardrails
- If there is movement but high generic share, report reduced insight quality honestly.
- If no import rows in month, report potential period mismatch before blaming dashboard.
- Do not claim cross-screen runtime proof unless E2E/browser evidence exists.
