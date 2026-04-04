import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createAuthenticatedSupabaseClient } from './helpers/manual-proof-helpers';

const TEST_MONTH = 11;
const TEST_YEAR = 2031;

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

async function selectAccountByLabel(page: any, label: string) {
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

function previewResponsibleTriggerForDescription(page: any, description: string) {
  return page
    .locator('table tbody tr')
    .filter({ hasText: description })
    .first()
    .locator('td')
    .nth(7)
    .getByRole('combobox');
}

test.describe('CSV import responsavel reliability (desktop)', () => {
  test('deve inferir por conta, preservar override manual e reduzir dependencia de ajuste posterior', async ({ page }) => {
    test.setTimeout(360000);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const isLocalBaseUrl = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(appUrl);
    test.skip(!isLocalBaseUrl, `Teste exige NEXT_PUBLIC_APP_URL local. Atual: ${appUrl || '(vazio)'}`);

    const runTag = `E2E_RESP_${Date.now()}`;
    const lote1DescA = `CSV RESPONSAVEL A ${runTag}`;
    const lote1DescB = `CSV RESPONSAVEL B ${runTag}`;
    const lote2DescA = `CSV RESPONSAVEL C ${runTag}`;
    const lote2DescB = `CSV RESPONSAVEL D ${runTag}`;
    const saldoInformado = '1000,00';
    const expectedSaldoAjusteValue = 1150;
    const supabaseClient = await createAuthenticatedSupabaseClient();
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData.user) {
      throw new Error('Nao foi possivel resolver usuario autenticado para fixture de contas E2E.');
    }
    const userId = authData.user.id;

    const csvPathLote1 = buildCsvFile(`fwm-resp-lote1-${runTag}`, [
      [`15/${pad2(TEST_MONTH)}/${TEST_YEAR}`, lote1DescA, '-100,00'],
      [`16/${pad2(TEST_MONTH)}/${TEST_YEAR}`, lote1DescB, '-50,00'],
    ]);
    const csvPathLote2 = buildCsvFile(`fwm-resp-lote2-${runTag}`, [
      [`20/${pad2(TEST_MONTH)}/${TEST_YEAR}`, lote2DescA, '-120,00'],
      [`21/${pad2(TEST_MONTH)}/${TEST_YEAR}`, lote2DescB, '-60,00'],
    ]);

    let saldoAjusteIds: string[] = [];
    let createdContaIds: string[] = [];
    let luanContaLabel = '';
    let luanaContaLabel = '';
    let luanContaId = '';

    try {
      const luanContaName = `E2E Conta Luan ${runTag}`;
      const luanaContaName = `E2E Conta Luana ${runTag}`;

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
        throw new Error('Nao foi possivel criar fixture minima de contas Luan/Luana para prova runtime.');
      }

      createdContaIds = createdContas.map((conta) => conta.id);
      const createdLuanConta = createdContas.find((conta) => conta.responsavel === 'Luan');
      const createdLuanaConta = createdContas.find((conta) => conta.responsavel === 'Luana');
      if (!createdLuanConta || !createdLuanaConta) {
        throw new Error('Fixture de contas nao retornou responsaveis esperados (Luan/Luana).');
      }
      luanContaLabel = `${createdLuanConta.nome} (${createdLuanConta.responsavel})`;
      luanaContaLabel = `${createdLuanaConta.nome} (${createdLuanaConta.responsavel})`;
      luanContaId = createdLuanConta.id;

      await page.goto('/conciliacao', { waitUntil: 'domcontentloaded', timeout: 30000 });

      await page.setInputFiles('#csv-upload', csvPathLote1);
      await page.locator('table tbody tr').first().waitFor({ state: 'visible', timeout: 120000 });

      await selectAccountByLabel(page, luanContaLabel);
      await expect(previewResponsibleTriggerForDescription(page, lote1DescA)).toContainText('Luan', { timeout: 10000 });
      await expect(previewResponsibleTriggerForDescription(page, lote1DescB)).toContainText('Luan', { timeout: 10000 });

      await selectAccountByLabel(page, luanaContaLabel);
      await expect(previewResponsibleTriggerForDescription(page, lote1DescA)).toContainText('Luana', { timeout: 10000 });
      await expect(previewResponsibleTriggerForDescription(page, lote1DescB)).toContainText('Luana', { timeout: 10000 });

      const firstRowResponsible = previewResponsibleTriggerForDescription(page, lote1DescA);
      await firstRowResponsible.click();
      await page.getByRole('option', { name: 'Casal', exact: true }).click();
      await expect(firstRowResponsible).toContainText('Casal', { timeout: 10000 });

      await selectAccountByLabel(page, luanContaLabel);
      await expect(previewResponsibleTriggerForDescription(page, lote1DescA)).toContainText('Casal', { timeout: 10000 });
      await expect(previewResponsibleTriggerForDescription(page, lote1DescB)).toContainText('Luan', { timeout: 10000 });

      await firstRowResponsible.click();
      await page.getByRole('option', { name: 'Luan', exact: true }).click();
      await expect(firstRowResponsible).toContainText('Luan', { timeout: 10000 });

      await page.locator('#saldo-inicial').fill(saldoInformado);

      const confirmButton = page.getByRole('button', { name: /Confirmar e Importar/i });
      await expect(confirmButton).toBeEnabled({ timeout: 15000 });
      await confirmButton.click();

      await page.getByRole('heading', { name: /Lote processado com sucesso/i }).waitFor({
        state: 'visible',
        timeout: 180000,
      });

      await expect(page.getByText(/Cobertura parcial do casal/i).first()).toBeVisible({ timeout: 15000 });

      const { data: lote1DbRows, error: lote1Error } = await supabaseClient
        .from('transacoes')
        .select('descricao,responsavel')
        .in('descricao', [lote1DescA, lote1DescB]);
      if (lote1Error) throw lote1Error;

      const rowA = lote1DbRows?.find((row) => row.descricao === lote1DescA);
      const rowB = lote1DbRows?.find((row) => row.descricao === lote1DescB);
      expect(rowA?.responsavel).toBe('Luan');
      expect(rowB?.responsavel).toBe('Luan');

      const { data: saldoAjustes, error: saldoAjusteError } = await supabaseClient
        .from('transacoes')
        .select('id,responsavel,valor,descricao')
        .eq('descricao', 'Ajuste de saldo inicial')
        .eq('conta_id', luanContaId)
        .eq('responsavel', 'Luan')
        .eq('valor', expectedSaldoAjusteValue)
        .gte('data', `${TEST_YEAR}-${pad2(TEST_MONTH)}-01T00:00:00.000Z`)
        .lte('data', `${TEST_YEAR}-${pad2(TEST_MONTH)}-30T23:59:59.999Z`);
      if (saldoAjusteError) throw saldoAjusteError;
      expect((saldoAjustes || []).length).toBeGreaterThan(0);
      saldoAjusteIds = (saldoAjustes || []).map((row) => row.id);

      await page.getByRole('button', { name: /Importar Outro Arquivo/i }).click();
      await page.setInputFiles('#csv-upload', csvPathLote2);
      await page.locator('table tbody tr').first().waitFor({ state: 'visible', timeout: 120000 });

      await selectAccountByLabel(page, luanaContaLabel);
      await expect(previewResponsibleTriggerForDescription(page, lote2DescA)).toContainText('Luana', { timeout: 10000 });
      await expect(previewResponsibleTriggerForDescription(page, lote2DescB)).toContainText('Luana', { timeout: 10000 });

      const confirmButtonLote2 = page.getByRole('button', { name: /Confirmar e Importar/i });
      await expect(confirmButtonLote2).toBeEnabled({ timeout: 15000 });
      await confirmButtonLote2.click();

      await page.getByRole('heading', { name: /Lote processado com sucesso/i }).waitFor({
        state: 'visible',
        timeout: 180000,
      });

      await expect(page.getByText(/Cobertura pronta para leitura consolidada/i).first()).toBeVisible({
        timeout: 15000,
      });

      const { data: lote2DbRows, error: lote2Error } = await supabaseClient
        .from('transacoes')
        .select('descricao,responsavel')
        .in('descricao', [lote2DescA, lote2DescB]);
      if (lote2Error) throw lote2Error;
      expect(lote2DbRows?.every((row) => row.responsavel === 'Luana')).toBe(true);

      const openPeriodButton = page.getByRole('button', { name: /Abrir extrato do periodo importado/i }).first();
      await expect(openPeriodButton).toBeVisible({ timeout: 15000 });
      await openPeriodButton.click();

      await expect(page.getByTestId('latest-imported-reading-card')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(lote1DescA).first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(lote2DescA).first()).toBeVisible({ timeout: 15000 });
      await expect(
        page
          .getByTestId('transaction-row')
          .filter({ hasText: lote1DescA })
          .first()
      ).toContainText('Luan', { timeout: 15000 });
      await expect(
        page
          .getByTestId('transaction-row')
          .filter({ hasText: lote1DescB })
          .first()
      ).toContainText('Luan', { timeout: 15000 });
      await expect(
        page
          .getByTestId('transaction-row')
          .filter({ hasText: lote2DescA })
          .first()
      ).toContainText('Luana', { timeout: 15000 });
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
