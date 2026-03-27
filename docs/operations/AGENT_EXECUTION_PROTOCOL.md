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
