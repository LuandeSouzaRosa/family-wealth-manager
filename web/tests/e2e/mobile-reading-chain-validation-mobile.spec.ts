import { expect, test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createAuthenticatedSupabaseClient } from './helpers/manual-proof-helpers';

const TEST_MONTH = 10;
const TEST_YEAR = 2099;

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

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function buildCsvFile(filePrefix: string, rows: Array<[string, string, string]>): string {
  const csvRows = [['Data', 'Descricao', 'Valor'], ...rows];
  const csv = csvRows.map((line) => line.join(',')).join('\n');
  const csvPath = path.join(os.tmpdir(), `${filePrefix}-${Date.now()}.csv`);
  fs.writeFileSync(csvPath, csv, 'utf-8');
  return csvPath;
}

async function selectAccountByLabel(page: Page, label: string) {
  const accountSelect = page
    .getByRole('button', { name: 'Cancelar' })
    .locator('xpath=..')
    .getByRole('combobox')
    .first();
  await accountSelect.click();
  const option = page.getByRole('option', { name: label, exact: true }).first();
  await expect(option).toBeVisible({ timeout: 10000 });
  await option.click();
}

function previewResponsibleTriggerForDescription(page: Page, description: string) {
  return page
    .locator('table tbody tr')
    .filter({ hasText: description })
    .first()
    .locator('td')
    .nth(7)
    .getByRole('combobox');
}

function previewCategoryTriggerForDescription(page: Page, description: string) {
  return page
    .locator('table tbody tr')
    .filter({ hasText: description })
    .first()
    .locator('td')
    .nth(5)
    .getByRole('combobox');
}

async function setPreviewCategory(page: Page, description: string, category: string) {
  const trigger = previewCategoryTriggerForDescription(page, description);
  await trigger.click();
  await page.getByRole('option', { name: category, exact: true }).click();
  await expect(trigger).toContainText(category, { timeout: 10000 });
}

async function setResponsibleOnMobile(page: Page, responsavel: 'Todos' | 'Luan' | 'Luana' | 'Casal') {
  await page.getByRole('button', { name: /abrir menu/i }).click();
  const trigger = page.getByRole('combobox').first();
  await trigger.click();
  await page.getByRole('option', { name: responsavel, exact: true }).click();
  await expect(trigger).toContainText(responsavel, { timeout: 15000 });
  await page.keyboard.press('Escape');
}

async function ensurePostImportBlocksVisible(page: Page) {
  const resumo = page.getByText(/Resumo inteligente do periodo importado/i).first();
  await resumo.scrollIntoViewIfNeeded();
  await expect(resumo).toBeVisible({ timeout: 15000 });

  const prioridades = page.getByText(/Prioridades do periodo importado/i).first();
  await prioridades.scrollIntoViewIfNeeded();
  await expect(prioridades).toBeVisible({ timeout: 15000 });

  const ganhoEsperado = page.getByText(/Ganho esperado:/i).first();
  await ganhoEsperado.scrollIntoViewIfNeeded();
  await expect(ganhoEsperado).toBeVisible({ timeout: 15000 });

  const fortalecimento = page.getByText(/Fortalecimento observado no resumo/i).first();
  await fortalecimento.scrollIntoViewIfNeeded();
  await expect(fortalecimento).toBeVisible({ timeout: 15000 });

  const ctaPeriodo = page.getByRole('button', { name: /Abrir extrato do periodo importado/i }).first();
  await ctaPeriodo.scrollIntoViewIfNeeded();
  await expect(ctaPeriodo).toBeVisible({ timeout: 15000 });
}

test.describe('Mobile reading chain validation', () => {
  test('deve manter fluxo pos-import e leitura persistente utilizaveis em mobile', async ({ page }) => {
    test.setTimeout(420000);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const isLocalBaseUrl = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(appUrl);
    test.skip(!isLocalBaseUrl, `Teste exige NEXT_PUBLIC_APP_URL local. Atual: ${appUrl || '(vazio)'}`);

    const runTag = `E2E_MOBILE_CHAIN_${Date.now()}`;
    const lote1PixDesc = `PIX ENVIADO ${runTag}`;
    const lote1MoradiaDesc = `MORADIA FIXA ${runTag}`;
    const lote2Desc = `SUPERMERCADO ${runTag}`;
    const saldoInformado = '1000,00';
    const expectedSaldoAjusteValue = 1150;

    const supabaseClient = await createAuthenticatedSupabaseClient();
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData.user) {
      throw new Error('Nao foi possivel resolver usuario autenticado para fixture mobile E2E.');
    }
    const userId = authData.user.id;

    const csvPathLote1 = buildCsvFile(`fwm-mobile-chain-lote1-${runTag}`, [
      [`15/${pad2(TEST_MONTH)}/${TEST_YEAR}`, lote1PixDesc, '-100,00'],
      [`16/${pad2(TEST_MONTH)}/${TEST_YEAR}`, lote1MoradiaDesc, '-50,00'],
    ]);
    const csvPathLote2 = buildCsvFile(`fwm-mobile-chain-lote2-${runTag}`, [
      [`20/${pad2(TEST_MONTH)}/${TEST_YEAR}`, lote2Desc, '-70,00'],
    ]);

    let saldoAjusteIds: string[] = [];
    let createdContaIds: string[] = [];

    try {
      const luanContaName = `E2E Mobile Luan ${runTag}`;
      const luanaContaName = `E2E Mobile Luana ${runTag}`;

      const { data: createdContas, error: createContasError } = await supabaseClient
        .from('contas_bancarias')
        .insert([
          {
            nome: luanContaName,
            instituicao: 'E2E',
            saldo_atual: 0,
            responsavel: 'Luan',
            cor: '#0ea5e9',
            user_id: userId,
          },
          {
            nome: luanaContaName,
            instituicao: 'E2E',
            saldo_atual: 0,
            responsavel: 'Luana',
            cor: '#f97316',
            user_id: userId,
          },
        ])
        .select('id,nome,responsavel');
      if (createContasError) throw createContasError;
      if (!createdContas || createdContas.length < 2) {
        throw new Error('Nao foi possivel criar fixture minima de contas Luan/Luana para validacao mobile.');
      }

      createdContaIds = createdContas.map((conta) => conta.id);
      const luanConta = createdContas.find((conta) => conta.responsavel === 'Luan');
      const luanaConta = createdContas.find((conta) => conta.responsavel === 'Luana');
      if (!luanConta || !luanaConta) {
        throw new Error('Fixture de contas nao retornou responsaveis esperados (Luan/Luana).');
      }

      const luanContaLabel = `${luanConta.nome} (${luanConta.responsavel})`;
      const luanaContaLabel = `${luanaConta.nome} (${luanaConta.responsavel})`;

      await page.goto('/conciliacao', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.locator('#csv-upload').waitFor({ state: 'attached', timeout: 15000 });
      await page.locator('#csv-upload').setInputFiles(csvPathLote1);
      await page.locator('table tbody tr').first().waitFor({ state: 'visible', timeout: 120000 });

      await selectAccountByLabel(page, luanContaLabel);
      await expect(previewResponsibleTriggerForDescription(page, lote1PixDesc)).toContainText('Luan', { timeout: 10000 });
      await expect(previewResponsibleTriggerForDescription(page, lote1MoradiaDesc)).toContainText('Luan', { timeout: 10000 });

      await setPreviewCategory(page, lote1PixDesc, 'Outros');
      await setPreviewCategory(page, lote1MoradiaDesc, 'Moradia');

      await page.locator('#saldo-inicial').fill(saldoInformado);
      await page.getByRole('button', { name: /Confirmar e Importar/i }).click();

      await page.getByRole('heading', { name: /Lote processado com sucesso/i }).waitFor({
        state: 'visible',
        timeout: 180000,
      });
      await ensurePostImportBlocksVisible(page);
      await expect(page.getByText(/Cobertura parcial do casal/i).first()).toBeVisible({ timeout: 15000 });

      const { data: saldoAjustes, error: saldoAjusteError } = await supabaseClient
        .from('transacoes')
        .select('id,responsavel,valor,conta_id')
        .eq('descricao', 'Ajuste de saldo inicial')
        .eq('responsavel', 'Luan')
        .eq('conta_id', luanConta.id)
        .eq('valor', expectedSaldoAjusteValue)
        .gte('data', `${TEST_YEAR}-${pad2(TEST_MONTH)}-01T00:00:00.000Z`)
        .lte('data', `${TEST_YEAR}-${pad2(TEST_MONTH)}-31T23:59:59.999Z`);
      if (saldoAjusteError) throw saldoAjusteError;
      expect((saldoAjustes || []).length).toBeGreaterThan(0);
      saldoAjusteIds = (saldoAjustes || []).map((row) => row.id);

      await page.getByRole('button', { name: /Importar Outro Arquivo/i }).click();
      await page.locator('#csv-upload').waitFor({ state: 'attached', timeout: 15000 });
      await page.locator('#csv-upload').setInputFiles(csvPathLote2);
      await page.locator('table tbody tr').first().waitFor({ state: 'visible', timeout: 120000 });

      await selectAccountByLabel(page, luanaContaLabel);
      await expect(previewResponsibleTriggerForDescription(page, lote2Desc)).toContainText('Luana', { timeout: 10000 });
      await setPreviewCategory(page, lote2Desc, 'Moradia');

      await page.getByRole('button', { name: /Confirmar e Importar/i }).click();
      await page.getByRole('heading', { name: /Lote processado com sucesso/i }).waitFor({
        state: 'visible',
        timeout: 180000,
      });
      await ensurePostImportBlocksVisible(page);
      await expect(page.getByText(/Cobertura pronta para leitura consolidada/i).first()).toBeVisible({
        timeout: 15000,
      });

      const { data: importedRunRows, error: importedRunRowsError } = await supabaseClient
        .from('transacoes')
        .select('data')
        .ilike('descricao', `%${runTag}%`)
        .order('data', { ascending: false });
      if (importedRunRowsError) throw importedRunRowsError;
      if (!importedRunRows || importedRunRows.length === 0) {
        throw new Error('Nao foi possivel localizar linhas importadas deste run para derivar periodo mobile.');
      }
      const importedReference = new Date(importedRunRows[0].data);
      if (Number.isNaN(importedReference.getTime())) {
        throw new Error('Data importada invalida ao derivar periodo mobile do run.');
      }
      const importedMonth = importedReference.getUTCMonth() + 1;
      const importedYear = importedReference.getUTCFullYear();
      const importedMonthLabel = MONTH_LABELS[importedMonth - 1];
      const outsideMonth = importedMonth === 1 ? 2 : importedMonth - 1;
      const outsideMonthLabel = MONTH_LABELS[outsideMonth - 1];

      await page.getByRole('button', { name: /Abrir extrato do periodo importado/i }).first().click();
      await expect(page.getByTestId('filter-year')).toBeVisible({ timeout: 15000 });
      await setResponsibleOnMobile(page, 'Luan');

      const yearTrigger = page.getByTestId('filter-year');
      await yearTrigger.click();
      await page.getByRole('option', { name: String(importedYear), exact: true }).click();
      const monthTrigger = page.getByTestId('filter-month');
      await monthTrigger.click();
      await page.getByRole('option', { name: importedMonthLabel, exact: true }).click();

      await expect(page.getByTestId('latest-imported-reading-card')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/Contexto temporal:/i).first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/Pendencia principal/i).first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('latest-reading-alignment')).toBeVisible({ timeout: 15000 });

      await monthTrigger.click();
      await page.getByRole('option', { name: outsideMonthLabel, exact: true }).click();
      await expect(page.getByTestId('latest-reading-alignment')).toContainText(/fora do recorte atual/i, {
        timeout: 15000,
      });

      const backToReading = page.getByRole('button', { name: /Voltar para o recorte da leitura/i }).first();
      await expect(backToReading).toBeVisible({ timeout: 15000 });
      const backHref = await backToReading.evaluate((element) => {
        const anchor = element.closest('a');
        return anchor?.getAttribute('href') || '';
      });
      const backParams = new URL(backHref, appUrl).searchParams;
      expect(backParams.get('month')).toBeTruthy();
      expect(backParams.get('year')).toBeTruthy();
      await yearTrigger.click();
      await page.getByRole('option', { name: String(importedYear), exact: true }).click();
      await monthTrigger.click();
      await page.getByRole('option', { name: importedMonthLabel, exact: true }).click();

      const categoryTrigger = page.getByTestId('filter-category');
      await categoryTrigger.click();
      await page.getByRole('option', { name: 'Outros', exact: true }).click();
      const mobileTransactionsList = page.locator('div.md\\:hidden.flex.flex-col.divide-y.divide-border');
      const pixCard = mobileTransactionsList.locator('div.p-4').filter({ hasText: lote1PixDesc }).first();
      await expect(pixCard).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/Pendencia principal \(ativa\)/i).first()).toBeVisible({ timeout: 15000 });

      await pixCard.getByTestId('btn-quick-edit-transaction').click();
      await page.getByRole('heading', { name: /Revis/i }).waitFor({ state: 'visible', timeout: 15000 });
      await page.getByTestId('quick-edit-categoria').click();
      await page.getByRole('option', { name: 'Moradia', exact: true }).click();
      await page.getByTestId('btn-quick-edit-salvar').click();

      await expect(page.getByRole('heading', { name: /Revis/i })).toHaveCount(0, { timeout: 15000 });
      await expect(page.getByTestId('latest-imported-reading-card')).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByText(/Pendencia principal \((ativa|reduzida|resolvida|sem pendencia relevante)\)/i).first()
      ).toBeVisible({ timeout: 15000 });
    } finally {
      await supabaseClient.from('transacoes').delete().ilike('descricao', `%${runTag}%`);
      if (saldoAjusteIds.length > 0) {
        await supabaseClient.from('transacoes').delete().in('id', saldoAjusteIds);
      }
      if (createdContaIds.length > 0) {
        await supabaseClient.from('contas_bancarias').delete().in('id', createdContaIds);
      }
      await supabaseClient.auth.signOut();

      if (fs.existsSync(csvPathLote1)) fs.unlinkSync(csvPathLote1);
      if (fs.existsSync(csvPathLote2)) fs.unlinkSync(csvPathLote2);
    }
  });
});
