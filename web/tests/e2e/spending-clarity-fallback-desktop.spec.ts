import { test, expect, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  buildUniqueDescription,
  cleanupTransactionsByDescription,
} from './helpers/manual-proof-helpers';

type Responsible = 'Luan' | 'Luana' | 'Casal';
type DashboardResponsible = Responsible | 'Todos';

type TxRow = {
  valor: number | string;
  tipo: string | null;
  status: string | null;
  responsavel: string | null;
};

type IsolatedIdentity = {
  email: string;
  password: string;
  userId: string;
  client: SupabaseClient;
};

const TARGET_WITHOUT_EXPENSE: Responsible = 'Luana';
const SOURCE_WITH_MOVEMENT: Responsible = 'Casal';
const FIXTURE_EXPENSE_TYPE = 'Sa\u00EDda';

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env "${name}" for spending clarity fallback E2E.`);
  }
  return value;
}

function createAdminSupabaseClient(): SupabaseClient {
  const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function createIsolatedIdentity(): Promise<IsolatedIdentity> {
  const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  const adminClient = createAdminSupabaseClient();
  const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e.spending.clarity.${nonce}@fwm.local`;
  const password = `Fwm!${Date.now()}Aa`;

  const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createUserError || !createdUser.user?.id) {
    throw new Error(`Unable to create isolated fallback E2E user: ${createUserError?.message ?? 'no-user-id'}`);
  }

  const client = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) {
    throw new Error(`Unable to sign in isolated fallback E2E user: ${signInError.message}`);
  }

  return {
    email,
    password,
    userId: createdUser.user.id,
    client,
  };
}

async function deleteIsolatedIdentity(userId: string): Promise<void> {
  const adminClient = createAdminSupabaseClient();
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) {
    throw new Error(`Unable to delete isolated fallback E2E user (${userId}): ${error.message}`);
  }
}

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

async function getCurrentMonthTransactions(client: SupabaseClient) {
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
  client: SupabaseClient,
  descricao: string,
  responsavel: Responsible,
  userId: string,
) {
  const payload = {
    descricao,
    valor: 17.89,
    categoria: 'Teste Coerencia Fallback',
    tipo: FIXTURE_EXPENSE_TYPE,
    data: new Date().toISOString(),
    responsavel,
    origem: 'Manual',
    status: 'Realizado',
    user_id: userId,
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

async function loginAsIsolatedUser(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });

  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === '/', { timeout: 60000 });
  await expect(page.getByTestId('dashboard-content')).toBeVisible({ timeout: 15000 });
}

async function waitForTodosTotalVisible(
  page: Page,
  runTag: string,
  timeoutMs: number,
) {
  const deadline = Date.now() + timeoutMs;
  const totalLocator = page.locator('p:has-text("Total de saidas realizadas:"):visible').first();
  let attempts = 0;

  while (Date.now() < deadline) {
    attempts += 1;

    await page.goto(`/?e2e_fallback_run=${encodeURIComponent(runTag)}&probe=${Date.now()}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await expect(page.getByTestId('dashboard-content')).toBeVisible({ timeout: 15000 });

    await setResponsibleFilter(page, 'Todos');
    if (await totalLocator.isVisible()) {
      return;
    }

    await page.waitForTimeout(5000);
  }

  throw new Error(
    `Dashboard nao exibiu total de saidas em Todos apos aguardar revalidacao (tentativas=${attempts}, timeoutMs=${timeoutMs})`
  );
}

test.describe('Spending Clarity fallback coherence (desktop)', () => {
  test('deve exibir fallback honesto quando Todos tem saidas e o filtro ativo nao tem saidas', async ({ page }) => {
    test.setTimeout(300000);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const isLocalBaseUrl = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(appUrl);
    test.skip(!isLocalBaseUrl, `Teste exige NEXT_PUBLIC_APP_URL local. Atual: ${appUrl || '(vazio)'}`);

    const runTag = buildUniqueDescription('E2E_CLARITY_FALLBACK');
    const fixtureDescription = `${runTag}_todos_com_saida`;

    const isolated = await createIsolatedIdentity();

    try {
      await cleanupTransactionsByDescription(isolated.client, fixtureDescription);
      await insertFixtureMovement(isolated.client, fixtureDescription, SOURCE_WITH_MOVEMENT, isolated.userId);

      const seededRows = await getCurrentMonthTransactions(isolated.client);
      const seededTotals = summarizeRealizedExpenseByResponsible(seededRows);
      const seededTodosTotal = seededTotals.Luan + seededTotals.Luana + seededTotals.Casal;

      if (seededTodosTotal <= 0) {
        throw new Error(
          `Fixture inserida nao foi reconhecida como saida realizada no mes atual. Totais apos seed: ${JSON.stringify(seededTotals)}`
        );
      }

      await loginAsIsolatedUser(page, isolated.email, isolated.password);
      await waitForTodosTotalVisible(page, runTag, 180000);

      await setResponsibleFilter(page, TARGET_WITHOUT_EXPENSE);
      await expect(
        page.locator(
          'p:has-text("Ja houve saidas realizadas no mes, mas nao neste filtro de responsavel. Ajuste o filtro ou revise a classificacao no extrato."):visible'
        ).first(),
      ).toBeVisible({ timeout: 15000 });

      await expect(page.getByText(/Nao houve saidas realizadas neste recorte\./i)).toHaveCount(0);

      const afterRows = await getCurrentMonthTransactions(isolated.client);
      const afterTotals = summarizeRealizedExpenseByResponsible(afterRows);
      const totalTodos = afterTotals.Luan + afterTotals.Luana + afterTotals.Casal;

      expect(totalTodos).toBeGreaterThan(0);
      expect(afterTotals[TARGET_WITHOUT_EXPENSE]).toBe(0);

      console.log(
        `SpendingClarity Fallback E2E: target=${TARGET_WITHOUT_EXPENSE} source=${SOURCE_WITH_MOVEMENT} totals=${JSON.stringify(afterTotals)}`,
      );
    } finally {
      await cleanupTransactionsByDescription(isolated.client, fixtureDescription);
      await isolated.client.auth.signOut();
      await deleteIsolatedIdentity(isolated.userId);
    }
  });
});
