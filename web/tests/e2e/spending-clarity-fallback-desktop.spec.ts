import { test, expect, type Page } from '@playwright/test';
import {
  buildUniqueDescription,
  cleanupTransactionsByDescription,
  createAuthenticatedSupabaseClient,
} from './helpers/manual-proof-helpers';

type Responsible = 'Luan' | 'Luana' | 'Casal';
type DashboardResponsible = Responsible | 'Todos';

type TxRow = {
  valor: number | string;
  tipo: string | null;
  status: string | null;
  responsavel: string | null;
};

const ZERO_TARGET_PRIORITY: Responsible[] = ['Luana', 'Luan', 'Casal'];

function normalizeToken(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isExpenseType(tipo: string | null): boolean {
  return normalizeToken(tipo) === 'saida';
}

function isRealized(status: string | null): boolean {
  const normalized = normalizeToken(status);
  return normalized !== 'agendado' && normalized !== 'pendente';
}

function summarizeRealizedExpenseByResponsible(rows: TxRow[]) {
  const totals: Record<Responsible, number> = {
    Luan: 0,
    Luana: 0,
    Casal: 0,
  };

  rows.forEach((row) => {
    if (!isExpenseType(row.tipo)) return;
    if (!isRealized(row.status)) return;

    const responsavel = (row.responsavel || '').trim();
    if (responsavel !== 'Luan' && responsavel !== 'Luana' && responsavel !== 'Casal') return;

    const value = Number(row.valor || 0);
    if (!Number.isFinite(value) || value <= 0) return;

    totals[responsavel] += value;
  });

  return totals;
}

function chooseZeroExpenseResponsible(totals: Record<Responsible, number>): Responsible | null {
  return ZERO_TARGET_PRIORITY.find((responsavel) => totals[responsavel] <= 0) ?? null;
}

async function getCurrentMonthTransactions(client: Awaited<ReturnType<typeof createAuthenticatedSupabaseClient>>) {
  const now = new Date();
  const startIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endExclusiveIso = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  const { data, error } = await client
    .from('transacoes')
    .select('valor, tipo, status, responsavel')
    .gte('data', startIso)
    .lt('data', endExclusiveIso);

  if (error) {
    throw new Error(`Failed to read current month transactions for fallback proof: ${error.message}`);
  }

  return (data || []) as TxRow[];
}

async function insertFixtureMovement(
  client: Awaited<ReturnType<typeof createAuthenticatedSupabaseClient>>,
  descricao: string,
  responsavel: Responsible,
) {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user?.id) {
    throw new Error(`Unable to resolve authenticated user for fallback fixture insertion: ${userError?.message ?? 'no-user'}`);
  }

  const payload = {
    descricao,
    valor: 17.89,
    categoria: 'Teste Coerencia Fallback',
    tipo: 'Saída',
    data: new Date().toISOString(),
    responsavel,
    origem: 'Manual',
    status: 'Realizado',
    user_id: userData.user.id,
  };

  const { error } = await client.from('transacoes').insert([payload] as any);
  if (error) {
    throw new Error(`Fallback fixture insertion failed: ${error.message}`);
  }
}

async function setResponsibleFilter(page: Page, responsavel: DashboardResponsible) {
  const trigger = page
    .locator('button[role="combobox"]')
    .filter({ hasText: /Todos|Luan|Luana|Casal/i })
    .first();

  await trigger.click();
  await page.getByRole('option', { name: responsavel, exact: true }).click();
  await expect(trigger).toContainText(responsavel, { timeout: 15000 });
}

test.describe('Spending Clarity fallback coherence (desktop)', () => {
  test('deve exibir fallback honesto quando Todos tem saidas e o filtro ativo nao tem saidas', async ({ page }) => {
    test.setTimeout(240000);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const isLocalBaseUrl = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(appUrl);
    test.skip(!isLocalBaseUrl, `Teste exige NEXT_PUBLIC_APP_URL local. Atual: ${appUrl || '(vazio)'}`);

    const runTag = buildUniqueDescription('E2E_CLARITY_FALLBACK');
    const fixtureDescription = `${runTag}_todos_com_saida`;
    const supabaseClient = await createAuthenticatedSupabaseClient();

    try {
      await cleanupTransactionsByDescription(supabaseClient, fixtureDescription);

      const beforeRows = await getCurrentMonthTransactions(supabaseClient);
      const beforeTotals = summarizeRealizedExpenseByResponsible(beforeRows);
      const targetWithoutExpense = chooseZeroExpenseResponsible(beforeTotals);

      test.skip(
        !targetWithoutExpense,
        `Sem responsável com saída realizada zerada no mês atual. Totais atuais: ${JSON.stringify(beforeTotals)}`,
      );

      const sourceWithMovement = (['Casal', 'Luan', 'Luana'] as Responsible[]).find(
        (responsavel) => responsavel !== targetWithoutExpense,
      ) as Responsible;

      await insertFixtureMovement(supabaseClient, fixtureDescription, sourceWithMovement);

      // Dashboard usa unstable_cache com revalidate=60. A fixture entra via cliente Supabase,
      // então aguardamos expiração para validar leitura real da UI sem alterar produto.
      await page.waitForTimeout(65000);

      await page.goto(`/?e2e_fallback_run=${encodeURIComponent(runTag)}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await expect(page.getByTestId('dashboard-content')).toBeVisible({ timeout: 15000 });

      await setResponsibleFilter(page, 'Todos');
      await expect(
        page.locator('p:has-text("Total de saidas realizadas:"):visible').first()
      ).toBeVisible({ timeout: 15000 });

      await setResponsibleFilter(page, targetWithoutExpense as Responsible);
      await expect(
        page.locator(
          'p:has-text("Ja houve saidas realizadas no mes, mas nao neste filtro de responsavel. Ajuste o filtro ou revise a classificacao no extrato."):visible'
        ).first(),
      ).toBeVisible({ timeout: 15000 });

      await expect(page.getByText(/Nao houve saidas realizadas neste recorte\./i)).toHaveCount(0);

      const afterRows = await getCurrentMonthTransactions(supabaseClient);
      const afterTotals = summarizeRealizedExpenseByResponsible(afterRows);
      const totalTodos = afterTotals.Luan + afterTotals.Luana + afterTotals.Casal;

      expect(totalTodos).toBeGreaterThan(0);
      expect(afterTotals[targetWithoutExpense as Responsible]).toBe(0);

      console.log(
        `SpendingClarity Fallback E2E: target=${targetWithoutExpense} source=${sourceWithMovement} totals=${JSON.stringify(afterTotals)}`,
      );
    } finally {
      await cleanupTransactionsByDescription(supabaseClient, fixtureDescription);
      await supabaseClient.auth.signOut();
    }
  });
});
