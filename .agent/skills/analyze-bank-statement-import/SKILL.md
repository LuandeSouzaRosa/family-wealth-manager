---
name: analyze-bank-statement-import
description: Use when the user provides a bank statement CSV and wants simulation quality analysis before importing, including generic category concentration and dashboard clarity risk.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Analyze Bank Statement Import (FWM)

Use this skill to simulate how a CSV statement would behave in the current FWM import pipeline.

## Scope
- Read a CSV file.
- Simulate import classification with current categorization rules.
- Quantify useful vs generic categorization outcomes.
- Estimate practical impact on dashboard spending clarity.

## Default Workflow
1. Get file path and target user email.
2. Run:
   - `npm run ops:analyze-bank-statement-import -- --file <csv-path> --email <email>`
3. Review generated report in `web/.tmp-ops/statement-analysis-*.json`.
4. Summarize:
   - total rows
   - importable rows
   - importable expenses value
   - generic (`Outros` / `Sem categoria`) row/value share
   - top problematic descriptions
   - expected clarity risk (`baixo|medio|alto`)

## Script Used
- `web/scripts/analyze-bank-statement-import.js`

## Decision Rules (small ROI focus)
- If generic value share is high, propose only small adjustments:
  - add/adjust categorization rules
  - small alias-based matching improvements
- Do not propose large feature expansion in this workflow.

## Evidence Discipline
- Mark simulation outcomes as `partially validated`.
- Mark only script execution as `proven by local runtime`.
- Do not claim dashboard runtime proof from this simulation alone.
