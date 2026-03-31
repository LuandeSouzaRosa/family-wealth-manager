import { expect, test, type Page } from '@playwright/test';
import { type SupabaseClient } from '@supabase/supabase-js';
import { createAuthenticatedSupabaseClient } from './helpers/manual-proof-helpers';

type RuntimeFixtureInput = {
  descricaoSuffix: string;
  tipo: 'Entrada' | 'Sa\u00edda';
  valor: number;
  dataIso: string;
  responsavel: 'Luan' | 'Luana' | 'Casal';
};

const MONTH_LABELS = [
  'Janeiro',
  'Fevereiro',
  'Mar\u00e7o',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function parseCurrencyPtBr(rawText: string | null): number {
  if (!rawText) throw new Error('Currency text was empty.');
  const numeric = rawText
    .replace(/\s+/g, '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const value = Number(numeric);
  if (Number.isNaN(value)) {
    throw new Error(`Failed to parse currency from "${rawText}"`);
  }
  return value;
}

async function setResponsibleFilter(page: Page, responsavel: 'Casal') {
  const trigger = page.locator('button[role="combobox"]').filter({ hasText: /Todos|Luan|Luana|Casal/i }).first();
  await trigger.click();
  await page.getByRole('option', { name: responsavel, exact: true }).click();
  await expect(trigger).toContainText(responsavel, { timeout: 15000 });
}

async function goToSidebarRoute(page: Page, route: 'Dashboard' | 'Extrato') {
  await page.getByRole('link', { name: route, exact: true }).first().click();
  if (route === 'Dashboard') {
    await expect(page.getByTestId('dashboard-content')).toBeVisible({ timeout: 15000 });
  } else {
    await expect(page.getByTestId('filter-year')).toBeVisible({ timeout: 15000 });
  }
}

async function goToFreshRoute(page: Page, route: '/' | '/transacoes', runTag: string) {
  const separator = route.includes('?') ? '&' : '?';
  await page.goto(`${route}${separator}coherence_run=${encodeURIComponent(runTag)}_${Date.now()}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  if (route === '/') {
    await expect(page.getByTestId('dashboard-content')).toBeVisible({ timeout: 15000 });
  } else {
    await expect(page.getByTestId('filter-year')).toBeVisible({ timeout: 15000 });
  }
}

async function setExtratoPeriod(page: Page, monthIndex: number, year: number) {
  const yearText = String(year);
  const monthText = MONTH_LABELS[monthIndex];

  const yearTrigger = page.getByTestId('filter-year');
  await yearTrigger.click();
  await page.getByRole('option', { name: yearText, exact: true }).click();

  const monthTrigger = page.getByTestId('filter-month');
  await monthTrigger.click();
  await page.getByRole('option', { name: monthText, exact: true }).click();

  await expect(yearTrigger).toContainText(yearText, { timeout: 15000 });
  await expect(monthTrigger).toContainText(monthText, { timeout: 15000 });
}

async function readDashboardMonthlyTotals(page: Page) {
  const rendaText = await page.getByTestId('dashboard-total-entradas').first().textContent();
  const despesasText = await page.getByTestId('dashboard-total-saidas').first().textContent();

  return {
    renda: parseCurrencyPtBr(rendaText),
    despesas: parseCurrencyPtBr(despesasText),
  };
}

async function readExtratoSummaryTotals(page: Page) {
  const receitasText = await page.getByTestId('extrato-total-entradas').first().textContent();
  const despesasText = await page.getByTestId('extrato-total-saidas').first().textContent();

  return {
    renda: parseCurrencyPtBr(receitasText),
    despesas: parseCurrencyPtBr(despesasText),
  };
}

async function insertRuntimeFixture(
  client: SupabaseClient,
  runTag: string,
  fixture: RuntimeFixtureInput[]
) {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user?.id) {
    throw new Error(`Unable to resolve authenticated user for fixture insertion: ${userError?.message ?? 'no-user'}`);
  }

  const rows = fixture.map((item) => ({
    descricao: `${runTag}_${item.descricaoSuffix}`,
    valor: item.valor,
    categoria: 'Teste Coerencia',
    tipo: item.tipo,
    data: item.dataIso,
    responsavel: item.responsavel,
    origem: 'Manual',
    status: 'Realizado',
    user_id: userData.user.id,
  }));

  const { error } = await client.from('transacoes').insert(rows as any);
  if (error) {
    throw new Error(`Runtime fixture insert failed: ${error.message}`);
  }

  return rows.map((row) => row.descricao);
}

async function assertNullResponsibleRejected(
  client: SupabaseClient,
  runTag: string,
  dataIso: string
) {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user?.id) {
    throw new Error(`Unable to resolve authenticated user for null-responsavel probe: ${userError?.message ?? 'no-user'}`);
  }

  const probeDescription = `${runTag}_null_responsavel_probe`;
  const payload = {
    descricao: probeDescription,
    valor: 1,
    categoria: 'Teste Coerencia',
    tipo: 'Sa\u00edda',
    data: dataIso,
    responsavel: null,
    origem: 'Manual',
    status: 'Realizado',
    user_id: userData.user.id,
  };

  const { error } = await client.from('transacoes').insert([payload] as any);
  expect(error).toBeTruthy();
  expect(error?.message.toLowerCase()).toContain('not-null');
}

async function cleanupFixtureByDescriptions(client: SupabaseClient, descriptions: string[]) {
  if (descriptions.length === 0) return;
  const { error } = await client.from('transacoes').delete().in('descricao', descriptions);
  if (error) {
    throw new Error(`Fixture cleanup failed: ${error.message}`);
  }
}

async function readFixtureRows(client: SupabaseClient, descriptions: string[]) {
  if (descriptions.length === 0) return [];
  const { data, error } = await client
    .from('transacoes')
    .select('descricao, valor, tipo, data, responsavel, status')
    .in('descricao', descriptions);

  if (error) {
    throw new Error(`Fixture read failed: ${error.message}`);
  }

  return data ?? [];
}

async function waitForDashboardDelta(
  page: Page,
  runTag: string,
  dashboardBefore: { renda: number; despesas: number },
  expectedDelta: { renda: number; despesas: number },
  timeoutMs = 30000
) {
  const start = Date.now();
  let dashboardAfter = dashboardBefore;
  let dashboardDelta = { renda: 0, despesas: 0 };

  while (Date.now() - start <= timeoutMs) {
    await goToFreshRoute(page, '/', runTag);
    await setResponsibleFilter(page, 'Casal');
    dashboardAfter = await readDashboardMonthlyTotals(page);
    dashboardDelta = {
      renda: dashboardAfter.renda - dashboardBefore.renda,
      despesas: dashboardAfter.despesas - dashboardBefore.despesas,
    };

    if (
      dashboardDelta.renda === expectedDelta.renda &&
      dashboardDelta.despesas === expectedDelta.despesas
    ) {
      return { dashboardAfter, dashboardDelta };
    }

    await page.waitForTimeout(2000);
  }

  return { dashboardAfter, dashboardDelta };
}

test.describe('Dashboard <-> Extrato runtime coherence (desktop)', () => {
  test('deve manter coerencia de renda/despesa no mesmo recorte com fronteira de mes e responsavel nulo', async ({ page }) => {
    test.setTimeout(300000);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const isLocalBaseUrl = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(appUrl);
    test.skip(!isLocalBaseUrl, `Teste exige NEXT_PUBLIC_APP_URL local. Atual: ${appUrl || '(vazio)'}`);

    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const startOfMonth = new Date(year, month, 1, 0, 0, 0, 0);
    const middleOfMonth = new Date(year, month, 15, 12, 0, 0, 0);
    const startOfNextMonth = new Date(year, month + 1, 1, 0, 0, 0, 0);

    const expectedDelta = {
      renda: 150,
      despesas: 100,
    };

    const runTag = `E2E_COHERENCE_${Date.now()}`;
    const fixture: RuntimeFixtureInput[] = [
      {
        descricaoSuffix: 'casal_entrada_fronteira_inicio_mes',
        tipo: 'Entrada',
        valor: 150,
        dataIso: startOfMonth.toISOString(),
        responsavel: 'Casal',
      },
      {
        descricaoSuffix: 'casal_saida_dentro_mes',
        tipo: 'Sa\u00edda',
        valor: 100,
        dataIso: new Date(middleOfMonth.getTime() + 60 * 60 * 1000).toISOString(),
        responsavel: 'Casal',
      },
      {
        descricaoSuffix: 'luan_saida_dentro_mes_nao_deve_entrar_em_casal',
        tipo: 'Sa\u00edda',
        valor: 60,
        dataIso: new Date(middleOfMonth.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        responsavel: 'Luan',
      },
      {
        descricaoSuffix: 'casal_saida_fronteira_proximo_mes_exclusiva',
        tipo: 'Sa\u00edda',
        valor: 999,
        dataIso: startOfNextMonth.toISOString(),
        responsavel: 'Casal',
      },
    ];

    const supabaseClient = await createAuthenticatedSupabaseClient();
    let insertedDescriptions: string[] = [];

    try {
      await goToFreshRoute(page, '/', runTag);
      await setResponsibleFilter(page, 'Casal');
      const dashboardBefore = await readDashboardMonthlyTotals(page);

      await goToFreshRoute(page, '/transacoes', runTag);
      await setResponsibleFilter(page, 'Casal');
      await setExtratoPeriod(page, month, year);
      await expect(page.getByText(/\(Casal\)/)).toBeVisible({ timeout: 15000 });
      const extratoBefore = await readExtratoSummaryTotals(page);

      await assertNullResponsibleRejected(supabaseClient, runTag, middleOfMonth.toISOString());
      insertedDescriptions = await insertRuntimeFixture(supabaseClient, runTag, fixture);
      const fixtureRows = await readFixtureRows(supabaseClient, insertedDescriptions);
      expect(fixtureRows).toHaveLength(fixture.length);

      // Dashboard usa cache com revalidate=60 e o setup de auth aquece "/".
      // Aguardamos a expiracao para avaliar leitura real de tela sem alterar produto.
      await page.waitForTimeout(65000);

      const { dashboardAfter, dashboardDelta } = await waitForDashboardDelta(
        page,
        runTag,
        dashboardBefore,
        expectedDelta
      );

      await goToFreshRoute(page, '/transacoes', runTag);
      await setResponsibleFilter(page, 'Casal');
      await setExtratoPeriod(page, month, year);
      await expect(page.getByText(/\(Casal\)/)).toBeVisible({ timeout: 15000 });
      const extratoAfter = await readExtratoSummaryTotals(page);

      const extratoDelta = {
        renda: extratoAfter.renda - extratoBefore.renda,
        despesas: extratoAfter.despesas - extratoBefore.despesas,
      };

      expect(dashboardDelta.renda).toBe(expectedDelta.renda);
      expect(dashboardDelta.despesas).toBe(expectedDelta.despesas);

      expect(extratoDelta.renda).toBe(expectedDelta.renda);
      expect(extratoDelta.despesas).toBe(expectedDelta.despesas);

      expect(dashboardDelta).toEqual(extratoDelta);
    } finally {
      await cleanupFixtureByDescriptions(supabaseClient, insertedDescriptions);
      await supabaseClient.auth.signOut();
    }
  });
});
