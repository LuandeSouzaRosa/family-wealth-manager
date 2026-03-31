import { test, expect, type Page } from '@playwright/test';
import {
  buildUniqueDescription,
  cleanupTransactionsByDescription,
  countManualPersistedByDescription,
  createAuthenticatedSupabaseClient,
} from './helpers/manual-proof-helpers';

const MONTH_LABELS = [
  'Janeiro',
  'Fevereiro',
  'Março',
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

function round2(value: number): number {
  return Number(value.toFixed(2));
}

async function goToFreshRoute(page: Page, route: '/' | '/transacoes', runTag: string) {
  const separator = route.includes('?') ? '&' : '?';
  await page.goto(`${route}${separator}post_mutation_run=${encodeURIComponent(runTag)}_${Date.now()}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  if (route === '/') {
    await expect(page.getByTestId('dashboard-content')).toBeVisible({ timeout: 15000 });
  } else {
    await expect(page.getByTestId('filter-year')).toBeVisible({ timeout: 15000 });
  }
}

async function setResponsibleFilter(page: Page, responsavel: 'Casal') {
  const trigger = page.locator('button[role="combobox"]').filter({ hasText: /Todos|Luan|Luana|Casal/i }).first();
  await trigger.click();
  await page.getByRole('option', { name: responsavel, exact: true }).click();
  await expect(trigger).toContainText(responsavel, { timeout: 15000 });
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

async function createManualExpenseViaUi(page: Page, descricao: string, valor: string) {
  const btnNovoGasto = page.locator('[data-testid="btn-nova-transacao"]:visible').first();
  await btnNovoGasto.click();

  const inputDesc = page.getByTestId('input-descricao').first();
  await inputDesc.waitFor({ state: 'visible', timeout: 10000 });
  await inputDesc.fill(descricao);
  await page.getByTestId('input-valor').fill(valor);

  const categoryTrigger = page.getByTestId('select-categoria').first();
  await categoryTrigger.click();
  await page.getByRole('option').first().click();

  const btnSalvar = page.getByTestId('btn-salvar-transacao').first();
  await btnSalvar.click();
  await expect(btnSalvar).toBeDisabled({ timeout: 5000 });
}

async function waitForCoherentDelta(
  page: Page,
  runTag: string,
  month: number,
  year: number,
  dashboardBefore: { renda: number; despesas: number },
  extratoBefore: { renda: number; despesas: number },
  expectedDelta: { renda: number; despesas: number },
  timeoutMs = 90000
) {
  const start = Date.now();
  let lastDashboardDelta = { renda: 0, despesas: 0 };
  let lastExtratoDelta = { renda: 0, despesas: 0 };

  while (Date.now() - start <= timeoutMs) {
    await goToFreshRoute(page, '/', runTag);
    await setResponsibleFilter(page, 'Casal');
    const dashboardAfter = await readDashboardMonthlyTotals(page);
    lastDashboardDelta = {
      renda: round2(dashboardAfter.renda - dashboardBefore.renda),
      despesas: round2(dashboardAfter.despesas - dashboardBefore.despesas),
    };

    await goToFreshRoute(page, '/transacoes', runTag);
    await setResponsibleFilter(page, 'Casal');
    await setExtratoPeriod(page, month, year);
    await expect(page.getByText(/\(Casal\)/)).toBeVisible({ timeout: 15000 });
    const extratoAfter = await readExtratoSummaryTotals(page);
    lastExtratoDelta = {
      renda: round2(extratoAfter.renda - extratoBefore.renda),
      despesas: round2(extratoAfter.despesas - extratoBefore.despesas),
    };

    const dashboardOk =
      lastDashboardDelta.renda === expectedDelta.renda &&
      lastDashboardDelta.despesas === expectedDelta.despesas;
    const extratoOk =
      lastExtratoDelta.renda === expectedDelta.renda &&
      lastExtratoDelta.despesas === expectedDelta.despesas;

    if (dashboardOk && extratoOk) {
      return { dashboardDelta: lastDashboardDelta, extratoDelta: lastExtratoDelta };
    }

    await page.waitForTimeout(2000);
  }

  throw new Error(
    `Timed out waiting coherent delta. dashboard=${JSON.stringify(lastDashboardDelta)} extrato=${JSON.stringify(lastExtratoDelta)} expected=${JSON.stringify(expectedDelta)}`
  );
}

test.describe('Dashboard <-> Extrato post-mutation coherence (desktop)', () => {
  test('deve refletir o mesmo delta apos 1 lancamento manual via UI', async ({ page }) => {
    test.setTimeout(300000);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const isLocalBaseUrl = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(appUrl);
    test.skip(!isLocalBaseUrl, `Teste exige NEXT_PUBLIC_APP_URL local. Atual: ${appUrl || '(vazio)'}`);

    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const runTag = buildUniqueDescription('E2E_POST_MUTATION');
    const descricaoUnica = `${runTag}_manual`;
    const expectedDelta = { renda: 0, despesas: 23.45 };

    const supabaseClient = await createAuthenticatedSupabaseClient();

    try {
      await cleanupTransactionsByDescription(supabaseClient, descricaoUnica);

      await goToFreshRoute(page, '/', runTag);
      await setResponsibleFilter(page, 'Casal');
      const dashboardBefore = await readDashboardMonthlyTotals(page);

      await goToFreshRoute(page, '/transacoes', runTag);
      await setResponsibleFilter(page, 'Casal');
      await setExtratoPeriod(page, month, year);
      await expect(page.getByText(/\(Casal\)/)).toBeVisible({ timeout: 15000 });
      const extratoBefore = await readExtratoSummaryTotals(page);

      await goToFreshRoute(page, '/', runTag);
      await createManualExpenseViaUi(page, descricaoUnica, '23.45');

      await expect.poll(
        () => countManualPersistedByDescription(supabaseClient, descricaoUnica),
        { timeout: 20000 }
      ).toBe(1);

      // Observacao: o dashboard usa cache/tag invalidation e pode ter janela curta
      // de propagacao apos mutacao. Fazemos polling explicito para medir leitura real de tela.
      const { dashboardDelta, extratoDelta } = await waitForCoherentDelta(
        page,
        runTag,
        month,
        year,
        dashboardBefore,
        extratoBefore,
        expectedDelta
      );

      expect(dashboardDelta).toEqual(expectedDelta);
      expect(extratoDelta).toEqual(expectedDelta);
      expect(dashboardDelta).toEqual(extratoDelta);

      console.log(
        `PostMutation Coherence E2E: descricao=${descricaoUnica} dashboardDelta=${JSON.stringify(dashboardDelta)} extratoDelta=${JSON.stringify(extratoDelta)}`
      );
    } finally {
      await cleanupTransactionsByDescription(supabaseClient, descricaoUnica);
      await supabaseClient.auth.signOut();
    }
  });
});

