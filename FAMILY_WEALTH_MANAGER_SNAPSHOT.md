## 1. FUNÇÕES-CHAVE CONFIRMADAS

- **criação de split**
  - **Arquivo**: `src/actions/transactions.ts`
  - **Função**: `createSplitTransaction(formData: FormData)`
  - **Evidência curta**: Cria ID único via `const splitGroupId = crypto.randomUUID()` e itera array, gravando: `const rows = parsed.data.splits.map((split) => ({ ... split_group_id: splitGroupId }))` no Supabase `insert(rows)`.
  - **Status**: Confirmado

- **exclusão em grupo por split_group_id**
  - **Arquivo**: `src/actions/transactions.ts`, `src/lib/transactions-logic.ts`
  - **Função**: `deleteTransaction(id: string)`, `getDeleteMatchCriteria(...)`
  - **Evidência curta**: Action seleciona `split_group_id` anterior, compila critério (`criteria.match`), e executa `supabase.from("transacoes").delete().match(criteria.match)`.
  - **Status**: Confirmado

- **bloqueio de edição parcial de split**
  - **Arquivo**: `src/app/transacoes/transacoes-client.tsx`
  - **Componente**: Listagem `<TableRow>`
  - **Evidência curta**: Botão `QuickEditTransactionDialog` tem prop condicional `disabled={!!tx.split_group_id}` que impede abertura do overlay de edições.
  - **Status**: Confirmado

- **lógica de reconciliação CSV/manual**
  - **Arquivo**: `src/lib/reconciliation-logic.ts`
  - **Função**: `findBestMatch(csvRow: CsvRow, candidates: CandidateTransaction[])`
  - **Evidência curta**: Compara tipo `(candidate.tipo !== csvRow.tipo)`, computa janela `daysDiff <= 7`, processa desvios `Math.abs(candidate.valor - csvRow.valor) > 0.05` e retorna enum tipado: `"Exato" | "Forte" | "Possível" | "Sem_Match"`.
  - **Status**: Confirmado

- **quick edit**
  - **Arquivo**: `src/actions/transactions.ts`
  - **Função**: `quickEditTransaction(id: string, formData: FormData)`
  - **Evidência curta**: Action revalida sessão/zod e isola o block update truncando vetores perigosos: `.update({ categoria: parsed.data.categoria, responsavel: parsed.data.responsavel }).match({ id, user_id })`.
  - **Status**: Confirmado

- **advisor**
  - **Arquivo**: `src/lib/ai-advisor-logic.ts`
  - **Função**: `generateInsights(...)`
  - **Evidência curta**: Lógica isolada analisa matriz transacional pura: `if (diffTotalPercent > 15 && !maiorSaltoNome) advice.push({ type: "warning" ... })`. 
  - **Status**: Confirmado

- **invalidateTag**
  - **Arquivo**: `src/actions/transactions.ts`
  - **Função**: `createTransaction`, `updateTransaction`, `deleteTransaction` etc.
  - **Evidência curta**: Encontrada exatamente como `invalidateTag(CACHE_TAGS.dashboard)` injetada após `.insert()` / `.update()` antes do `return { success: true }`.
  - **Status**: Confirmado

- **revalidatePath**
  - **Arquivo**: `src/actions/transactions.ts`
  - **Trecho**: Encontrado estritamente como `revalidatePath("/transacoes")`.
  - **Status**: Confirmado

- **getUser**
  - **Arquivo**: `src/actions/transactions.ts`
  - **Trecho**: `const { data: { user } } = await supabase.auth.getUser(); if (!user) ...` bloqueando execuções lógicas nas actions exportadas.
  - **Status**: Confirmado

- **safeParse**
  - **Arquivo**: `src/actions/transactions.ts`
  - **Trecho**: `const parsed = TransactionSchema.safeParse(data); if (!parsed.success) return handleError(...)`.
  - **Status**: Confirmado


## 2. BUSCAS LITERAIS

- **split_group_id**
  - `src/types/database.ts`
  - `src/lib/transactions-logic.ts`
  - `src/lib/reconciliation-logic.ts`
  - `src/lib/reconciliation-logic.test.ts`
  - `src/components/quick-edit-dialog.tsx`
  - `src/app/transacoes/transacoes-client.tsx`
  - `src/actions/reconciliation.ts`
  - `src/actions/transactions.test.ts`
  - `src/actions/transactions.ts`

- **revalidatePath(**
  - `src/actions/transactions.ts`
  - `src/actions/recurrences.ts`
  - `src/actions/investments.ts`
  - `src/app/login/actions.ts`
  - `src/actions/goals.ts`
  - `src/actions/family.ts`
  - `src/actions/categories.ts`
  - `src/actions/budgets.ts`
  - `src/actions/assets.ts`
  - `src/actions/accounts.ts`

- **revalidatePath("/")**
  - Nenhum resultado encontrado.

- **invalidateTag**
  - `src/lib/cache.ts`
  - `src/actions/transactions.ts`
  - `src/actions/recurrences.ts`
  - `src/actions/investments.ts`
  - `src/actions/goals.ts`
  - `src/actions/budgets.ts`
  - `src/actions/accounts.ts`

- **unstable_cache**
  - `src/lib/cache.ts`
  - `src/actions/dashboard.ts`
  - `src/actions/budgets.ts`

- **getUser(**
  - `src/utils/supabase/middleware.ts`
  - `src/actions/transactions.ts`
  - `src/actions/recurrences.ts`
  - `src/actions/reconciliation.ts`
  - `src/actions/investments.ts`
  - `src/actions/goals.ts`
  - `src/actions/dashboard.ts`
  - `src/actions/family.ts`
  - `src/actions/categories.ts`
  - `src/actions/budgets.ts`
  - `src/actions/assets.ts`
  - `src/actions/ai-advisor.ts`
  - `src/actions/accounts.ts`

- **QuickEditTransactionDialog**
  - `src/components/quick-edit-dialog.tsx`
  - `src/app/transacoes/transacoes-client.tsx`

- **csv-importer**
  - `src/components/csv-importer.tsx`
  - `src/app/conciliacao/page.tsx`

- **ai-advisor**
  - `src/components/dashboard/ai-advisor-widget.tsx`
  - `src/app/dashboard-client.tsx`
  - `src/actions/ai-advisor.test.ts`
  - `src/actions/ai-advisor.ts`
  - `src/lib/ai-advisor-logic.ts`

- **pluggy**
  - Nenhum resultado encontrado.


## 3. TESTES REAIS
Confirmada presença exata dos seguintes arquivos `*.test.ts`:
- `src/actions/ai-advisor.test.ts`
- `src/actions/transactions.test.ts`
- `src/lib/quick-add-parser.test.ts`
- `src/lib/reconciliation-logic.test.ts`
- `src/lib/schemas.test.ts`
- `src/tests/logic.test.ts`


## 4. BUILD E TEST
- **`npm run test`**
Executado. Resultado:
`Exit code 0`.
Duration `11.40s`.
O output apontou "✓ 33 testes validados" cobrindo instâncias de `schemas.test.ts`, `reconciliation-logic.test.ts`, `quick-add-parser.test.ts`, `transactions.test.ts` e `ai-advisor.test.ts`.

- **`npm run build`**
Executado. Resultado:
`Exit code 0`.
O output encerrou como `✓ Finalizing page optimization in 14.2s`. Resumo aponta a construção e consolidação paralela SSR compilada do Root e Rotas vitais como `Route (app) /`, `/_not-found`, `/cartoes`, etc, sem emitir erros de quebra de tipos.


## 5. DIVERGÊNCIAS REAIS
NÃO CONSEGUI CONFIRMAR DIVERGÊNCIA.
