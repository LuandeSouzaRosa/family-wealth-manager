import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createAuthenticatedSupabaseClient } from './helpers/manual-proof-helpers';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function buildCsvFile(runTag: string): { csvPath: string; month: number; year: number } {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const rows = [
    ['Data', 'Descricao', 'Valor'],
    [`05/${pad2(month)}/${year}`, `ZZZ REVISAO OUTROS ${runTag}`, '-137,19'],
    [`06/${pad2(month)}/${year}`, `Mercado rotina ${runTag}`, '-83,47'],
  ];

  const csv = rows.map((line) => line.join(',')).join('\n');
  const csvPath = path.join(os.tmpdir(), `fwm-outros-review-${runTag}.csv`);
  fs.writeFileSync(csvPath, csv, 'utf-8');

  return { csvPath, month, year };
}

test.describe('Post-import Outros review CTA (desktop)', () => {
  test('deve sair do recibo real para o extrato ja no contexto de revisao de Outros', async ({ page }) => {
    test.setTimeout(240000);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const isLocalBaseUrl = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(appUrl);
    test.skip(!isLocalBaseUrl, `Teste exige NEXT_PUBLIC_APP_URL local. Atual: ${appUrl || '(vazio)'}`);

    const runTag = `E2E_OUTROS_${Date.now()}`;
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

      const summaryTitle = page.getByText(/Resumo inteligente do periodo importado/i).first();
      await expect(summaryTitle).toBeVisible({ timeout: 15000 });
      const prioritiesTitle = page.getByText(/Prioridades do periodo importado/i).first();
      await expect(prioritiesTitle).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/Proxima acao recomendada/i).first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/Ganho esperado:/i).first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/Fortalecimento observado no resumo/i).first()).toBeVisible({ timeout: 15000 });

      const leaderCta = page.getByRole('button', { name: /Revisar lider no extrato|Auditar .* no extrato/i }).first();
      await expect(leaderCta).toBeVisible({ timeout: 15000 });
      const leaderHref = await leaderCta.evaluate((element) => {
        const anchor = element.closest('a');
        return anchor?.getAttribute('href');
      });
      expect(leaderHref).toContain(`/transacoes?month=${month}&year=${year}`);
      expect(leaderHref).toContain('category=');
      expect(leaderHref).toContain('sort=value_desc');
      expect(leaderHref).toContain('responsavel=');

      const outrosContext = page.getByText(/Restaram\s+\d+\s+linha\(s\)\s+em\s+"Outros"\s+somando/i).first();
      await expect(outrosContext).toBeVisible({ timeout: 15000 });

      const ambiguousCta = page.getByRole('button', { name: /Revisar ambiguos de maior impacto/i }).first();
      await expect(ambiguousCta).toBeVisible({ timeout: 15000 });
      const ambiguousHref = await ambiguousCta.evaluate((element) => {
        const anchor = element.closest('a');
        return anchor?.getAttribute('href');
      });
      expect(ambiguousHref).toBeTruthy();
      expect(ambiguousHref).toContain(`/transacoes?month=${month}&year=${year}`);
      expect(ambiguousHref).toContain('review=ambiguous');
      expect(ambiguousHref).toContain('sort=value_desc');

      const ambiguousPage = await page.context().newPage();
      const ambiguousUrl = new URL(ambiguousHref!, appUrl).toString();
      await ambiguousPage.goto(ambiguousUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await expect(ambiguousPage.getByTestId('filter-year')).toBeVisible({ timeout: 15000 });
      await expect(ambiguousPage.getByTestId('latest-imported-reading-card')).toBeVisible({ timeout: 15000 });
      await expect(ambiguousPage.getByText(/Ultima leitura util do periodo importado/i).first()).toBeVisible({ timeout: 15000 });
      await expect(ambiguousPage.getByText(/Contexto temporal:/i).first()).toBeVisible({ timeout: 15000 });
      await expect(ambiguousPage.getByText(/Recencia:/i).first()).toBeVisible({ timeout: 15000 });
      await expect(ambiguousPage.getByText(/Coerencia com filtros ativos:/i).first()).toBeVisible({ timeout: 15000 });
      await expect(ambiguousPage.getByText(/Pendencia principal/i).first()).toBeVisible({ timeout: 15000 });

      const ambiguousCurrentUrl = new URL(ambiguousPage.url());
      expect(ambiguousCurrentUrl.pathname).toBe('/transacoes');
      expect(ambiguousCurrentUrl.searchParams.get('month')).toBe(String(month));
      expect(ambiguousCurrentUrl.searchParams.get('year')).toBe(String(year));
      expect(ambiguousCurrentUrl.searchParams.get('review')).toBe('ambiguous');
      expect(ambiguousCurrentUrl.searchParams.get('sort')).toBe('value_desc');
      await expect(
        ambiguousPage.getByText(/Modo revisao: ambiguos de maior impacto/i).first()
      ).toBeVisible({ timeout: 15000 });
      const clearReviewButton = ambiguousPage.getByRole('button', { name: /Ver todas no periodo/i }).first();
      await expect(clearReviewButton).toBeVisible({ timeout: 15000 });
      await clearReviewButton.click();
      await expect(ambiguousPage.getByTestId('filter-year')).toBeVisible({ timeout: 15000 });
      const clearedUrl = new URL(ambiguousPage.url());
      expect(clearedUrl.searchParams.get('review')).toBeNull();
      await ambiguousPage.close();

      const cta = page.getByRole('button', { name: /Revisar maiores em Outros/i }).first();
      await expect(cta).toBeVisible({ timeout: 15000 });
      await cta.click();

      await expect(page.getByTestId('filter-year')).toBeVisible({ timeout: 15000 });

      const currentUrl = new URL(page.url());
      expect(currentUrl.pathname).toBe('/transacoes');
      expect(currentUrl.searchParams.get('month')).toBe(String(month));
      expect(currentUrl.searchParams.get('year')).toBe(String(year));
      expect(currentUrl.searchParams.get('category')).toBe('Outros');
      expect(currentUrl.searchParams.get('sort')).toBe('value_desc');

      await expect(page.getByTestId('filter-category')).toContainText('Outros', { timeout: 15000 });
      await expect(page.getByTestId('filter-sort')).toContainText('Maior valor', { timeout: 15000 });
      await expect(page.getByText(runTag).first()).toBeVisible({ timeout: 15000 });
    } finally {
      await supabaseClient.from('transacoes').delete().ilike('descricao', `%${runTag}%`);
      await supabaseClient.auth.signOut();
      if (fs.existsSync(csvPath)) {
        fs.unlinkSync(csvPath);
      }
    }
  });
});
