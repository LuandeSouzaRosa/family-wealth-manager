# 🚀 Family Wealth Manager: Guia de Operação Beta (Uso Real)

Bem-vindo ao Beta Interno do Family Wealth Manager! O aplicativo foi desenhado para organizar a vida financeira do casal sem complicação.

## 🎯 Nosso Foco Agora
**Uso diário consistente.** Não estamos caçando features novas, mas sim testando se o sistema nos dá *paz de espírito e confiança nos números*. Todas as integrações Open Banking (Pluggy) sumiram do radar para focar 100% no motor matemático do controle patrimonial.

---

## 📋 1. Smoke Test Checklist (Primeira Validação)

Antes de começar a usar o app para registrar tudo, abram e façam esse teste guiado rápido para testar o terreno.

### 🔐 Acesso e Overview
- [ ] **Login/Autorização:** O sistema reconhece os usuários corretamente?
- [ ] **Dashboard Inicial (Todos):** O patrimônio líquido total listado resume fielmente os ativos e débitos sem erros grotescos?
- [ ] **Filtros por pessoa (A engrenagem do app):** 
  - Ao escolher `Luan` no topo da tela, os gráficos de receitas e despesas exibem apenas a vida dele?
  - E para a `Luana`? 
  - Para o botão `Casal`? Ele não tem que mostrar a soma (Isso é `Todos`), mas sim as transações explicitamente rotuladas "isso é conta do Casal em comum".

### 💸 Gestão de Lançamentos
- [ ] **Quick Add (Botão Inferior ou "Nova Transação"):** Inserir "Almoço R$ 80". Reflete em segundos na listagem global?
- [ ] **Painel de Despesas:** Criar despesa manual debita fielmente do saldo bancário?
- [ ] **Transferências:** Mover dinheiro da Conta A para a Conta B altera os salaldos individuais sem enriquecer digitalmente a família?
- [ ] **O Fator "Cartão":** Ao apontar uma compra no Cartão de Crédito da Luana, o limite do cartão preencheu com exatidão? E a "Fatura Atual" assumiu o saldo da transação?

### ⚖️ O Coração do App: Split Assíncrono
- [ ] **Split 50/50:** A compra do Supermercado (R$ 500) dividida no meio. O painel global anota -500. No Dashboard de Luan, consta -250? Em Luana, -250?
- [ ] **Inflexão do Split:** Caso edite parcial um lançamento split, ele te bloqueia avisando e exige excluir o registro-pai? (Comportamento by design agora para segurança do db).

### 🧠 UX de Borda
- [ ] **Parsing via CSV:** Escolheu um arquivo, ele rodou e evitou duplicações do que já tinha sido importado mês passado?
- [ ] **Orçamentos no Talo:** Caso bata R$ 1000 num limite de R$ 1000 estipulado, o AI Advisor sinaliza? A barrinha ficou vermelha?
- [ ] **Microcopys Aclarificadas:** Não existe ponta solta prometendo coisas que o App não faz (Ex: "Sincronização Automática com XP"?).

---

## 🛠️ 2. Orientação de Operação (Real-Life Readiness)

### O Plano de Trilha (Primeiros 7 dias)
1. **Rotina Passiva (CSV First):** Guardem seus recibos maiores. No fim de semana sentem-se juntos e rodem a importação CSV do extrato dos últimos dias.
2. **Rotina Ativa (Quick Add Second):** Se o Luan for almoçar na rua, usem o celular ali mesmo na mesa e puxem o Quick Add. 15 segundos para dar robustez no histórico imediato.

### Foco Sensitivo (O que anotar e jogar no Backlog?)
* **CRÍTICO 🔴 (Parei de confiar):** 
  * Gastos estornando sozinhos;
  * Resumos na Dashboard inflando valores porque considerou cartão de crédito como "Dinheiro entrando" contra a física do universo.
* **TOLERADO 🟡 (Atrito Operacional - Viveremos com isso essa versão):**
  * Não ter edição granulada de um split já criado (Avisado).
  * Telatinhas de Android/iOS desalinhadas com o teclado virtual subindo over a UI.
  * O AI Advisor demorar 5-7 segundos para pensar.

### Regra de Ouro
Se por qualquer motivo sentirem aversão imediata a um bug e medo de corromper o histórico: PAREM E REPORTEM. Esse MVP não será preenchido para ser destruído amanhã. Sucesso no Trial! 🚀
