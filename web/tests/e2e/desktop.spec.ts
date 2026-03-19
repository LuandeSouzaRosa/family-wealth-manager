import { test, expect } from '@playwright/test';

test.describe('Desktop E2E Suite', () => {

  test('Filtros globais preservam contexto coerente', async ({ page }) => {
    await page.goto('/');
    
    // Clicar no seletor e trocar para Esposa
    const trigger = page.locator('button[role="combobox"]').first();
    await trigger.click();
    await page.getByRole('option', { name: "Esposa" }).click();

    // Validar mudança em Orçamentos sem perder o filtro
    await page.getByRole('link', { name: 'Orçamentos' }).first().click();
    await expect(page.getByText(/Visualizando: Esposa/i)).toBeVisible();
    await expect(page.getByText(/Nenhum orçamento encontrado para Esposa/i)).toBeVisible();
  });

  test('Tabela mantém renderização horizontal clássica', async ({ page }) => {
    await page.goto('/transacoes');
    
    // Esperar a tabela principal renderizar (Desktop sempre tem Thead)
    const tabela = page.locator('table').first();
    await expect(tabela).toBeVisible();

    // Como operamos sem mocks destrutivos, a base pode estar populada ou vazia. 
    // Testamos a renderização de Ações (lixeira) OU do fallback de Empty State (Importar Extrato)
    const emptyStateBotao = page.getByRole('button', { name: /Importar Extrato/i }).first();
    const lixeira = page.getByTitle(/Excluir/i).first();
    
    await expect(emptyStateBotao.or(lixeira)).toBeAttached();
  });
});
