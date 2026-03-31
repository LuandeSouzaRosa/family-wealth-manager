# Protocolo de Execução de Agentes

Ao operar no repositório **FWM**, a IA assume a responsabilidade pelas seguintes premissas de conduta e qualidade cirúrgica.

## 1. Princípios Básicos (Não é um projeto novo)
- O FWM possui regras e uma estrutura Next.js/Supabase fechada.
- É estritamente proibido criar módulos do zero ou ignorar a árvore atual usando "boilerplates AI" sem observar como as coisas foram construídas. (Ex: Use nossos botões e modais existentes no `<AddTransaction>`).

## 2. Escopo de Intervenção Limitado
- As entregas devem focar-se na **menor superfície de quebra sintática** para consertar um bug ou incluir comportamento secundário.
- Decisões fechadas são inegociáveis: `split_group_id` para divisão de gastos, dependência severa em rotinas de teste e CSV-first absoluto.
- Invariantes de fluxo descritos em arquivos `docs/quality/FINANCIAL_INVARIANTS.md` ditam ordens absolutas de semântica.

## 3. Qualidade da Entrega e "DRY"
- Não gere documentações replicadas nem injete comentários gigantes em código auto-explicativo.
- Justifique explicitamente qualquer escolha de design complexa para o humano, caso ocorra trade-off.

## 4. Garantia de Saúde Pós-Interferência
- Mudanças enraizadas em lógica financeira (`lib/`) ou ações primárias de gravação (`actions/`) não devem se dar por finalizadas sem que haja uma afirmação tática provada via execuções de lint, testes ou builds no ambiente local.

## 5. Runbook Local - Prova Manual Double-Submit
- Comando padrao local (executar em `web/`):
  - `npm run test:e2e:manual-double-submit:local`
- Variaveis obrigatorias em `.env.local`:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `TEST_EMAIL`
  - `TEST_PASSWORD`
- O comando sobe servidor local (`http://127.0.0.1:3001`) e roda, em sequencia:
  - `tests/e2e/double-submit-desktop.spec.ts` (`chromium-desktop`)
  - `tests/e2e/double-submit-mobile.spec.ts` (`chromium-mobile`)
- Criterio de prova: efeito de negocio (submissao unica com persistencia unica), nao contagem bruta de POST.
  - Evidencia esperada: `manualSubmitRequestCount=1` e `1` transacao manual persistida por descricao unica (com cleanup no final).

## 6. Runbook Local - Prova Quick Add
- Comando padrao local (executar em `web/`):
  - `npm run test:e2e:quick-add:local`
- Variaveis obrigatorias em `.env.local`:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `TEST_EMAIL`
  - `TEST_PASSWORD`
- O comando sobe servidor local (`http://127.0.0.1:3001`) e roda, em sequencia:
  - `tests/e2e/quick-add-desktop.spec.ts` (`chromium-desktop`)
  - `tests/e2e/quick-add-mobile.spec.ts` (`chromium-mobile`)
- Criterio de prova: submit unico e persistencia unica por descricao unica (com cleanup no final).

## 7. Runbook Local - Coerencia Dashboard <-> Extrato
- Comando padrao local (executar em `web/`):
  - `npm run test:e2e:dashboard-extrato-coherence:local`
- Variaveis obrigatorias em `.env.local`:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `TEST_EMAIL`
  - `TEST_PASSWORD`
- O comando sobe servidor local (`http://127.0.0.1:3001`) e roda:
  - `tests/e2e/dashboard-extrato-coherence-desktop.spec.ts` (`chromium-desktop`)
- Criterio de prova: no mesmo recorte de periodo/responsavel, o delta de agregado (Dashboard) bate com o delta do detalhado (Extrato), usando fixture controlada e cleanup.

## 8. Validacao Pratica Curta - Card de Clareza de Gastos
- Janela sugerida: 3 a 7 dias de uso real no beta interno.
- Momento de uso: primeira abertura do Dashboard no dia.
- Checklist rapido (responder `sim` ou `nao`):
  - Em ate 5 segundos, ficou claro o principal problema do mes?
  - O insight principal pareceu util (nao generico)?
  - O CTA `Revisar no extrato` ajudou a ir para acao?
  - O bloco `Ajuste sugerido de maior impacto` ajudou ou ficou vago?
- Registro minimo recomendado: 1 linha por dia (`data`, `responsavel`, `sim/nao` por pergunta, observacao curta).
- Criterio simples de leitura: se houver `nao` recorrente na mesma pergunta por 3 dias, abrir microajuste de copy/ordem (sem nova feature).
