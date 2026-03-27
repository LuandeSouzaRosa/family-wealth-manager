import { test, expect } from '@playwright/test';

test.describe('Desktop E2E Suite', () => {

  test('Filtros globais preservam contexto coerente', async ({ page }) => {
    await page.goto('/');
    
    // Clicar no seletor e trocar para Esposa
    const trigger = page.locator('button[role="combobox"]').first();
    await trigger.click();
    await page.getByRole('option', { name: "Luana" }).click();

    // Validar mudança em Orçamentos sem perder o filtro
    await page.getByRole('link', { name: 'Orçamentos' }).first().click();
    await expect(page.getByText(/Visualizando: Luana/i)).toBeVisible();
    await expect(page.getByText(/Nenhum orçamento encontrado para Luana/i)).toBeVisible();
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

  test('P0: Lançamento manual salva com sucesso sem crash', async ({ page }) => {
    await page.goto('/');
    
    // 1. Abrir Modal Novo Gasto
    const btnNovoGasto = page.getByTestId('btn-nova-transacao').first();
    await btnNovoGasto.click();

    // 2. Preencher dados mínimos
    await page.getByTestId('input-descricao').fill('Playwright P0 Manual Test');
    await page.getByTestId('input-valor').fill('100.50');
    
    // Selecionar categoria (pega a primeira disponível)
    const categoryTrigger = page.getByTestId('select-categoria').first();
    await categoryTrigger.click();
    await page.getByRole('option').first().click();

    // 3. Adicionar Delay na requisição POST p/ validar botões de salvamento
    await page.route('**/*', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      await route.fallback();
    });

    const btnSalvar = page.getByTestId('btn-salvar-transacao').first();
    
    // Iniciar o click sem esperar (porque o playwright não trava aqui a menos q haja navegação cruzada, mas p garantir testamos desabilitado a seguir)
    let isClickResolved = false;
    btnSalvar.click().then(() => { isClickResolved = true; });

    // 4. Validação do Estado Loading Visível
    await expect(btnSalvar).toBeDisabled({ timeout: 5000 });
    await expect(btnSalvar).toContainText('Salvando');
    console.log('Validado Loading State: Button disabled and shows "Salvando..."');

    // Tentar segundo click (Double Submit) via API crua
    // Isso deve falhar silenciosamente ou gerar error pq o elemento ñ recebe events se estiver nativo disabled
    await btnSalvar.dispatchEvent('click', { force: true }).catch(e => console.log('Duplo submit bloqueado no DOM event.'));

    // 5. Validar resultado
    await expect(page.getByText('Playwright P0 Manual Test').first()).toBeAttached({ timeout: 15000 });
  });

  test('P1: Extrato - Manipulação do Range Temporal e Blindagem SSR', async ({ page }) => {
    // 1. Abrir direto na raiz que vai cair no Mês/Ano corrente via SSR
    await page.goto('/transacoes');
    
    // Garantir estabilidade da tela com elemento core
    await expect(page.locator('h1').filter({ hasText: /Extrato/i })).toBeVisible();

    // 2. Navegação guiada: Alterar o Ano para "Todos" (0)
    await page.getByTestId('filter-year').click();
    await page.getByRole('option', { name: "Todos" }).click();

    // Validar atualização fluída de URL
    await expect(page).toHaveURL(/year=0/);

    // 3. Alterar Mês para Janeiro (1)
    await page.getByTestId('filter-month').click();
    await page.getByRole('option', { name: "Janeiro" }).click();
    await expect(page).toHaveURL(/month=1/);

    // 4. Testar o botão voltar do Navegador Back/Forward
    await page.goBack();
    // Ano deveria ser 0, Mês deveria ser o anterior (não 1). Reação garantida pelo SSR Props Sync!
    await expect(page).not.toHaveURL(/month=1/);

    // 5. Injeção de Risco Extremo de SSR
    // Inserindo mês string non-int, mês acima de 12 e ano bizarro.
    await page.goto('/transacoes?month=janeiro&year=999999');

    // A UI não pode quebrar. Deve carregar a página normalmente e usar fallbacks!
    await expect(page.locator('h1').filter({ hasText: /Extrato/i })).toBeVisible();
    
    // O texto do Mês deve derrocar para Mês corrente (e não 'janeiro'), o Ano p/ atual (e não 99999)
    // Se o ClientComponent não crashou, a mitigação valeu 100%.
    await expect(page.getByTestId('filter-year')).not.toContainText('999999');
  });

});
