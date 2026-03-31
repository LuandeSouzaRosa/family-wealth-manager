import { test, expect } from '@playwright/test';
import {
  buildUniqueDescription,
  cleanupTransactionsByDescription,
  countManualPersistedByDescription,
  createAuthenticatedSupabaseClient,
} from './helpers/manual-proof-helpers';

function buildLettersOnlyToken(length = 8) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return token;
}

test.describe('Quick Add Mobile E2E', () => {
  test('deve garantir submit unico e persistencia unica no Quick Add (mobile)', async ({ page }) => {
    test.setTimeout(90000);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const isLocalBaseUrl = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(appUrl);
    test.skip(!isLocalBaseUrl, `Teste exige NEXT_PUBLIC_APP_URL local. Atual: ${appUrl || '(vazio)'}`);

    const token = buildLettersOnlyToken();
    const runId = buildUniqueDescription('E2E_QA').split('_').at(-1) ?? 'run';
    const rawInput = `ifood ${token} 45 hoje`;
    const expectedDescription = `Ifood ${token}`;

    const supabaseClient = await createAuthenticatedSupabaseClient();
    let quickAddSubmitRequestCount = 0;

    const countPersisted = async () => {
      return countManualPersistedByDescription(supabaseClient, expectedDescription);
    };

    try {
      await cleanupTransactionsByDescription(supabaseClient, expectedDescription);

      await page.route('**/*', async (route) => {
        const request = route.request();
        if (request.method() === 'POST') {
          const headers = request.headers();
          const body = request.postData() || '';
          const isQuickAddSubmit = Boolean(headers['next-action']) && body.includes(expectedDescription);
          if (isQuickAddSubmit) {
            quickAddSubmitRequestCount++;
          }
        }

        await route.continue();
      });

      await page.goto('/');

      await page.getByTestId('quick-add-toggle').click();
      const quickAddInput = page.getByTestId('quick-add-input');
      await quickAddInput.fill(rawInput);

      const quickAddSubmit = page.getByTestId('quick-add-submit');
      await expect(quickAddSubmit).toBeEnabled();

      await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="quick-add-submit"]');
        if (!btn) return;
        btn.click();
        btn.click();
        btn.click();
        btn.click();
      });

      await expect.poll(countPersisted, { timeout: 20000 }).toBe(1);
      await page.waitForTimeout(2000);
      await expect.poll(countPersisted, { timeout: 5000 }).toBe(1);

      expect(quickAddSubmitRequestCount).toBe(1);

      console.log(
        `QuickAdd E2E: run=${runId} input="${rawInput}" expected="${expectedDescription}" submitCount=${quickAddSubmitRequestCount}`
      );
    } finally {
      await cleanupTransactionsByDescription(supabaseClient, expectedDescription);
      await supabaseClient.auth.signOut();
    }
  });
});
