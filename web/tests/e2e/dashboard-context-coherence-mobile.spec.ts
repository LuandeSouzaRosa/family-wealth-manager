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

async function openMobileDrawer(page: Page) {
  await page.getByRole('button', { name: /abrir menu/i }).click();
}

async function setResponsibleOnMobile(page: Page, responsavel: 'Luana') {
  await openMobileDrawer(page);
  const trigger = page.getByRole('combobox').first();
  await trigger.click();
  await page.getByRole('option', { name: responsavel, exact: true }).click();
  await expect(trigger).toContainText(responsavel, { timeout: 15000 });

  // Fecha o drawer sem trocar de rota.
  await page.keyboard.press('Escape');
}

test.describe('Dashboard -> Extrato context coherence (mobile)', () => {
  test('deve abrir extrato com month/year explicitos e manter responsavel apos reload', async ({ page }) => {
    test.setTimeout(120000);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const isLocalBaseUrl = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(appUrl);
    test.skip(!isLocalBaseUrl, `Teste exige NEXT_PUBLIC_APP_URL local. Atual: ${appUrl || '(vazio)'}`);

    const now = new Date();
    const expectedMonth = String(now.getMonth() + 1);
    const expectedYear = String(now.getFullYear());
    const expectedMonthLabel = MONTH_LABELS[now.getMonth()];

    await page.goto(`/?context_coherence_mobile_run=${Date.now()}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await expect(page.getByTestId('dashboard-content')).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => window.localStorage.removeItem('fwm_responsavel_filter'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('dashboard-content')).toBeVisible({ timeout: 15000 });

    await setResponsibleOnMobile(page, 'Luana');

    const reviewButton = page.getByRole('button', { name: /revisar no extrato/i }).first();
    await reviewButton.scrollIntoViewIfNeeded();
    await reviewButton.click();

    await expect(page.getByTestId('filter-year')).toBeVisible({ timeout: 15000 });

    const currentUrl = new URL(page.url());
    expect(currentUrl.pathname).toBe('/transacoes');
    expect(currentUrl.searchParams.get('month')).toBe(expectedMonth);
    expect(currentUrl.searchParams.get('year')).toBe(expectedYear);

    await expect(page.getByTestId('filter-year')).toContainText(expectedYear, { timeout: 15000 });
    await expect(page.getByTestId('filter-month')).toContainText(expectedMonthLabel, { timeout: 15000 });

    await page.goto('/?context_coherence_mobile_return=1', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await expect(page.getByTestId('dashboard-content')).toBeVisible({ timeout: 15000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('dashboard-content')).toBeVisible({ timeout: 15000 });

    await openMobileDrawer(page);
    await expect(page.getByRole('combobox').first()).toContainText('Luana', { timeout: 15000 });

    const storedResponsible = await page.evaluate(() => window.localStorage.getItem('fwm_responsavel_filter'));
    expect(storedResponsible).toBe('Luana');
  });
});
