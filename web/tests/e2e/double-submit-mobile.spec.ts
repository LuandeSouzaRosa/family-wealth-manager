import { test, expect } from '@playwright/test';
import {
  buildUniqueDescription,
  cleanupTransactionsByDescription,
  countManualPersistedByDescription,
  createAuthenticatedSupabaseClient,
} from './helpers/manual-proof-helpers';

test.describe('Fase 4D Mobile - Synchronous Guard Runtime Hardening', () => {
  test('Deve garantir submissao unica com criterio de persistencia real no lancamento manual (mobile)', async ({ page }) => {
    test.setTimeout(90000);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const isLocalBaseUrl = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(appUrl);
    test.skip(!isLocalBaseUrl, `Teste exige NEXT_PUBLIC_APP_URL local. Atual: ${appUrl || '(vazio)'}`);

    const descricaoUnica = buildUniqueDescription('E2E_MANUAL_DOUBLE_MOBILE');
    const supabaseClient = await createAuthenticatedSupabaseClient();
    let manualSubmitRequestCount = 0;

    const countPersistedByDescription = async () => {
      return countManualPersistedByDescription(supabaseClient, descricaoUnica);
    };

    try {
      await cleanupTransactionsByDescription(supabaseClient, descricaoUnica);

      await page.route('**/*', async (route) => {
        const request = route.request();
        if (request.method() === 'POST') {
          const headers = request.headers();
          const body = request.postData() || '';
          const isManualSubmit = Boolean(headers['next-action']) && body.includes(descricaoUnica);

          if (isManualSubmit) {
            manualSubmitRequestCount++;
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }

        await route.continue();
      });

      await page.goto('/');

      const btnNovoGastoByTestId = page.getByTestId('btn-nova-transacao').first();
      if (await btnNovoGastoByTestId.isVisible().catch(() => false)) {
        await btnNovoGastoByTestId.scrollIntoViewIfNeeded();
        await btnNovoGastoByTestId.click();
      } else {
        await page.locator('text=Novo Gasto').first().click();
      }

      const inputDesc = page.getByTestId('input-descricao').first();
      await inputDesc.waitFor({ state: 'visible', timeout: 8000 });

      await inputDesc.fill(descricaoUnica);
      await page.getByTestId('input-valor').fill('99.99');

      const categoryTrigger = page.getByTestId('select-categoria').first();
      await categoryTrigger.click();
      await page.getByRole('option').first().click();

      await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="btn-salvar-transacao"]') as HTMLButtonElement | null;
        if (!btn) return;
        btn.click();
        btn.click();
        btn.click();
        btn.click();
        btn.click();
      });

      const btnSalvar = page.getByTestId('btn-salvar-transacao').first();
      await expect(btnSalvar).toBeDisabled({ timeout: 5000 });
      await expect(btnSalvar).toContainText('Salvando');

      await expect.poll(countPersistedByDescription, { timeout: 20000 }).toBe(1);
      await page.waitForTimeout(2000);
      await expect.poll(countPersistedByDescription, { timeout: 5000 }).toBe(1);

      expect(manualSubmitRequestCount).toBe(1);

      console.log(`Auditoria 4D Mobile: descricao=${descricaoUnica} manualSubmitRequestCount=${manualSubmitRequestCount}`);
    } finally {
      await cleanupTransactionsByDescription(supabaseClient, descricaoUnica);
      await supabaseClient.auth.signOut();
    }
  });
});
