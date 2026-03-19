import { test, expect } from '@playwright/test';

test.describe('Mobile E2E Suite', () => {

  test('Renderização Híbrida do Extrato de Transações', async ({ page }) => {
    // Definir viewport forçada menor se o dispositivo default falhar (garantia extra)
    await page.setViewportSize({ width: 390, height: 844 });
    
    await page.goto('/transacoes');
    
    // O Next.js passa por hidratação, então a tabela pode piscar no SSR. 
    // O toBeHidden entra em retries nativos automaticamente aguardando o laytout sumir.
    const tabela = page.locator('table');
    await expect(tabela).toBeHidden({ timeout: 10000 });

    // Em vez de lixeira cega que depende de dados, testamos se a visão renderiza ações ou Cards de empty state
    const cardEmptyState = page.getByRole('button', { name: /Importar Extrato/i }).first();
    const btnExcluirMobile = page.getByRole('button', { name: /Excluir/i }).first();
    
    await expect(cardEmptyState.or(btnExcluirMobile)).toBeVisible();
  });

});
