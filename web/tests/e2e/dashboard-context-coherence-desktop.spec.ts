import { expect, test, type Page } from '@playwright/test';

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

function getResponsibleTrigger(page: Page) {
  return page.locator('button[role="combobox"]').filter({ hasText: /Todos|Luan|Luana|Casal/i }).first();
}

async function setResponsibleFilter(page: Page, responsavel: 'Luana') {
  const trigger = getResponsibleTrigger(page);
  await trigger.click();
  await page.getByRole('option', { name: responsavel, exact: true }).click();
  await expect(trigger).toContainText(responsavel, { timeout: 15000 });
}

test.describe('Dashboard -> Extrato context coherence (desktop)', () => {
  test('deve abrir Extrato no mes/ano explicitos e manter responsavel apos refresh', async ({ page }) => {
    test.setTimeout(120000);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const isLocalBaseUrl = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(appUrl);
    test.skip(!isLocalBaseUrl, `Teste exige NEXT_PUBLIC_APP_URL local. Atual: ${appUrl || '(vazio)'}`);

    const now = new Date();
    const expectedMonth = String(now.getMonth() + 1);
    const expectedYear = String(now.getFullYear());
    const expectedMonthLabel = MONTH_LABELS[now.getMonth()];

    await page.goto(`/?context_coherence_run=${Date.now()}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await expect(page.getByTestId('dashboard-content')).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => window.localStorage.removeItem('fwm_responsavel_filter'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('dashboard-content')).toBeVisible({ timeout: 15000 });

    await setResponsibleFilter(page, 'Luana');

    await page.getByRole('button', { name: /revisar no extrato/i }).first().click();
    await expect(page.getByTestId('filter-year')).toBeVisible({ timeout: 15000 });

    const currentUrl = new URL(page.url());
    expect(currentUrl.pathname).toBe('/transacoes');
    expect(currentUrl.searchParams.get('month')).toBe(expectedMonth);
    expect(currentUrl.searchParams.get('year')).toBe(expectedYear);

    await expect(page.getByTestId('filter-year')).toContainText(expectedYear, { timeout: 15000 });
    await expect(page.getByTestId('filter-month')).toContainText(expectedMonthLabel, { timeout: 15000 });

    await page.getByRole('link', { name: 'Dashboard', exact: true }).first().click();
    await expect(page.getByTestId('dashboard-content')).toBeVisible({ timeout: 15000 });

    const responsibleTrigger = getResponsibleTrigger(page);
    await expect(responsibleTrigger).toContainText('Luana', { timeout: 15000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('dashboard-content')).toBeVisible({ timeout: 15000 });
    await expect(getResponsibleTrigger(page)).toContainText('Luana', { timeout: 15000 });
  });
});
