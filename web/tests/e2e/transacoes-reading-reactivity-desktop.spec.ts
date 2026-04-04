import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createAuthenticatedSupabaseClient } from './helpers/manual-proof-helpers';

const TEST_MONTH = 12;
const TEST_YEAR = 2030;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function buildCsvFile(runTag: string): { csvPath: string; month: number; year: number } {
  const rows = [
    ['Data', 'Descricao', 'Valor'],
    [`05/${pad2(TEST_MONTH)}/${TEST_YEAR}`, `ZZZ REATIVIDADE LEITURA ${runTag}`, '-137,19'],
    [`06/${pad2(TEST_MONTH)}/${TEST_YEAR}`, `Mercado rotina ${runTag}`, '-83,47'],
  ];

  const csv = rows.map((line) => line.join(',')).join('\n');
  const csvPath = path.join(os.tmpdir(), `fwm-reading-reactivity-${runTag}.csv`);
  fs.writeFileSync(csvPath, csv, 'utf-8');

  return { csvPath, month: TEST_MONTH, year: TEST_YEAR };
}

test.describe('Transacoes reading reactivity (desktop)', () => {
  test('deve atualizar leitura persistente apos revisao relevante no proprio extrato', async ({ page }) => {
    test.setTimeout(300000);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const isLocalBaseUrl = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(appUrl);
    test.skip(!isLocalBaseUrl, `Teste exige NEXT_PUBLIC_APP_URL local. Atual: ${appUrl || '(vazio)'}`);

    const runTag = `E2E_REACTIVE_${Date.now()}`;
    const { csvPath, month, year } = buildCsvFile(runTag);
    const supabaseClient = await createAuthenticatedSupabaseClient();

    try {
      await page.goto('/conciliacao', { waitUntil: 'domcontentloaded', timeout: 30000 });

      await page.setInputFiles('#csv-upload', csvPath);
      await page.locator('table tbody tr').first().waitFor({ state: 'visible', timeout: 120000 });

      const confirmButton = page.getByRole('button', { name: /Confirmar e Importar/i });
      await expect(confirmButton).toBeEnabled({ timeout: 15000 });
      await confirmButton.click();

      await page.getByRole('heading', { name: /Lote processado com sucesso/i }).waitFor({
        state: 'visible',
        timeout: 180000,
      });

      const outrosCta = page.getByRole('button', { name: /Revisar maiores em Outros/i }).first();
      await expect(outrosCta).toBeVisible({ timeout: 15000 });
      await outrosCta.click();

      await expect(page.getByTestId('filter-year')).toBeVisible({ timeout: 15000 });
      const currentUrl = new URL(page.url());
      expect(currentUrl.pathname).toBe('/transacoes');
      expect(currentUrl.searchParams.get('month')).toBe(String(month));
      expect(currentUrl.searchParams.get('year')).toBe(String(year));
      expect(currentUrl.searchParams.get('category')).toBe('Outros');
      expect(currentUrl.searchParams.get('sort')).toBe('value_desc');

      const latestReadingCard = page.getByTestId('latest-imported-reading-card');
      await expect(latestReadingCard).toBeVisible({ timeout: 15000 });
      await expect(latestReadingCard.getByText(/Pendencia principal \(ativa\)/i)).toBeVisible({ timeout: 15000 });

      const row = page.getByTestId('transaction-row').filter({ hasText: runTag }).first();
      await expect(row).toBeVisible({ timeout: 15000 });

      await row.getByTestId('btn-quick-edit-transaction').click();
      await page.getByRole('heading', { name: /Revis/i }).waitFor({ state: 'visible', timeout: 15000 });

      await page.getByTestId('quick-edit-categoria').click();
      await page.getByRole('option', { name: 'Moradia' }).click();
      await page.getByTestId('btn-quick-edit-salvar').click();

      await expect(page.getByRole('heading', { name: /Revis/i })).toHaveCount(0, { timeout: 15000 });

      const updatedRows = page.getByTestId('transaction-row').filter({ hasText: runTag });
      await expect(updatedRows).toHaveCount(0, { timeout: 15000 });
      await expect(page.getByText(runTag).first()).toHaveCount(0, { timeout: 15000 });

      await expect(
        latestReadingCard.getByText(/Pendencia principal \((sem pendencia relevante|resolvida)\)/i)
      ).toBeVisible({ timeout: 15000 });
    } finally {
      await supabaseClient.from('transacoes').delete().ilike('descricao', `%${runTag}%`);
      await supabaseClient.auth.signOut();
      if (fs.existsSync(csvPath)) {
        fs.unlinkSync(csvPath);
      }
    }
  });
});
