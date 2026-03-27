import { test, expect } from '@playwright/test';

test.describe('Mobile Manual Transaction Crash Debug', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // Mobile viewport

  test('Deve capturar logs precisos ao adicionar uma transação manual', async ({ page }) => {
    const errorLogs: string[] = [];
    const consoleLogs: string[] = [];

    page.on('pageerror', exception => {
      errorLogs.push(`[PAGE_ERROR] ${exception.message}`);
    });
    
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.text().includes('DEBUG')) {
        consoleLogs.push(`[CONSOLE] ${msg.type()}: ${msg.text()}`);
      }
    });

    // 1. Ir para a página inicial (que redireciona para login/dashboard)
    await page.goto('/');

    // 2. Se pedir login, fazemos usando o setup mock ou auth fixo.
    // O projeto tem auth.setup.ts, então já deve estar logado no storageState.
    await page.waitForTimeout(2000);

    consoleLogs.push("Acessando Dashboard...");
    
    // 3. Verifica se estamos no dashboard.
    await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 15000 });

    // 4. Abrir modal manual (Mobile)
    const novoGastoBtn = page.locator('text=Novo Gasto').first();
    await novoGastoBtn.click();

    // 5. Preencher dados fictícios mínimos
    await page.waitForTimeout(1000);
    const descricaoInput = page.getByTestId('input-descricao').first(); // ou selector equivalente
    if (await descricaoInput.isVisible()) {
      await descricaoInput.fill('Teste Mobile Crash');
      
      const valorInput = page.getByTestId('input-valor').first();
      await valorInput.fill('10.50'); // Test input format
      
      // Submit
      const btnSalvar = page.getByTestId('btn-salvar-transacao').first();
      consoleLogs.push("Clicando em Salvar Transação...");
      await btnSalvar.click();

      // Esperar possível crash ou retorno
      await page.waitForTimeout(3000);
    } else {
      consoleLogs.push("Não encontrou o input de descrição, tentando fallback...");
      await page.locator('input[name="descricao"]').fill('Fallback Test');
      await page.locator('input[name="valor"]').fill('10.50');
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(3000);
    }

    // Grava os resultados em arquivo pra inspeção do LLM
    const fs = require('fs');
    fs.writeFileSync('crash-debug-results.json', JSON.stringify({ errorLogs, consoleLogs }, null, 2));
    
    console.log("Finalizado. Logs gerados.");
  });
});
