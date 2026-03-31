# Real Import Workflows (CSV-first)

Operational runbook for reusable local workflows:
- safe reset before real import
- statement simulation analysis
- real import via `/conciliacao` UI
- post-import validation

## Prerequisites
- Run from `web/`
- `.env.local` with:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `TEST_EMAIL` (or pass `--email`)
  - `TEST_PASSWORD` (or pass `--password`)
- local app server running at `NEXT_PUBLIC_APP_URL` (default expected by ops script: `http://127.0.0.1:3001`)

## 1) Safe reset before real import
Command:
- `npm run ops:prepare-real-import-reset -- --dry-run --email <email>`
- `npm run ops:prepare-real-import-reset -- --confirm --email <email>`

What it does:
- creates snapshot JSON under `web/.tmp-ops/`
- resolves target user with paginated lookup and prints `email + user_id + Supabase URL`
- clears only `transacoes` for target user
- preserves categorization and config tables:
  - `regras_categorizacao`, `categorias`, `contas_bancarias`, `orcamentos`, `metas`, `recorrentes`
- validates before/after counts
- validates `regras_categorizacao` integrity by deterministic content hash (not only count)

Dry-run behavior:
- no deletion
- no `--confirm` required
- prints target user, target Supabase URL, before counts and reset plan
- writes a dry-run report under `web/.tmp-ops/`

Critical policy:
- categorization rules must be preserved

## 2) Statement import simulation analysis
Command:
- `npm run ops:analyze-bank-statement-import -- --file <csv-path> --email <email>`

What it does:
- reads CSV locally
- simulates classification with current categorization rules
- reports:
  - total/importable rows
  - generic category concentration
  - top problematic descriptions
  - expected clarity risk for dashboard

## 3) Real import via `/conciliacao` UI
Command:
- `npm run ops:real-import-ui -- --file <csv-path> --email <email>`
- optional:
  - `--password <password>`
  - `--base-url http://127.0.0.1:3001`

What it does:
- logs into app via `/login`
- opens `/conciliacao`
- uploads real CSV through UI (no direct DB injection)
- confirms import and captures receipt observability fields
- writes report under `web/.tmp-ops/ui-real-import-*.json` with:
  - `rawReceiptText`
  - `importedCountText`
  - `conciliatedCountText`
  - `ignoredCountText`
  - parsing method/fallback/warnings

## 4) Post-import validation
Command:
- `npm run ops:post-import-validation -- --email <email> --year <YYYY> --month <MM>`
- month/year optional (defaults to current month)

What it validates:
- import rows present in month
- realized expense base present
- generic concentration on realized expenses
- top categories and generic-heavy descriptions

## Evidence language
When reporting results, classify explicitly:
- implemented in code
- audited by inspection
- partially validated
- proven by automated test
- proven by local runtime
- not proven yet
