import { test, expect } from '@playwright/test';

test.describe('Fase 4D - Synchronous Guard Runtime Hardening', () => {

  test('Deve bloquear disparos múltiplos síncronos no Modal de Lançamento Manual', async ({ page }) => {
    // Escutando as chamadas para a rota da API (Server Actions form-data batem na mesma página por padrão, 
    // mas enviam um POST com o header Next-Action).
    let nextActionCount = 0;

    await page.route('**/*', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
          nextActionCount++;
          // Atraso artificial maciço para esticar a janela de rendering do React State ao limite
          await new Promise(resolve => setTimeout(resolve, 3000));
      }
      await route.continue();
    });

    await page.goto('/');
    
    // 1. Abrir Modal Novo Gasto
    const btnNovoGasto = page.getByTestId('btn-nova-transacao').first();
    await btnNovoGasto.click();

    // Aguarda animação Shadcn renderizar modal visivel
    const inputDesc = page.getByTestId('input-descricao').first();
    await inputDesc.waitFor({ state: 'visible', timeout: 8000 });

    // 2. Preencher
    await inputDesc.fill('Playwright Hardening Sync Lock');
    await page.getByTestId('input-valor').fill('99.99');
    
    // 3. Selecionar categoria
    const categoryTrigger = page.getByTestId('select-categoria').first();
    await categoryTrigger.click();
    await page.getByRole('option').first().click();

    // 4. Executar agressão de clique síncrono (Rage-clicker / Enter pressionado).
    // O page.evaluate injeta script real direto no browser e zera qualquer interrupçao do Node.js,
    // garantindo zero delay (mesmo Tick do Event Loop) entre as chamas.
    await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="btn-salvar-transacao"]') as HTMLButtonElement;
        if (btn) {
            btn.click();
            btn.click();
            btn.click();
            btn.click();
            btn.click();
        }
    });

    // 5. Validar estado visual loading garantido
    const btnSalvar = page.getByTestId('btn-salvar-transacao').first();
    await expect(btnSalvar).toBeDisabled({ timeout: 5000 });
    await expect(btnSalvar).toContainText('Salvando');

    // Esperamos as rotas se resolverem (tempo de rede simulado de 2 segundos)
    await page.waitForTimeout(3000);

    // O Guard de useRef DEVE ter bloqueado os cliques 2, 3, 4 e 5! Apenas 1 rede enviada!
    // Se fosse o antigo isPending (React State Guard), 5 Next-Actions teriam saído voando!
    expect(nextActionCount).toBe(1);
    
    console.log(`Auditoria 4D: Recebeu exatamente ${nextActionCount} request(s) de POST Server Action.`);
  });
  
});
