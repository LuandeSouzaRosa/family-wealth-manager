# Family Wealth Manager - PRD Rascunho

## 1. Visão Geral do Produto
O Family Wealth Manager é uma aplicação web para gestão financeira pessoal e familiar avançada. O objetivo é permitir que indivíduos e famílias controlem seu fluxo de caixa, orçamento mensal e evolução patrimonial em um único lugar, com uma interface moderna e responsiva.

## 2. Objetivos de Negócio
- Centralizar informações financeiras dispersas.
- Proporcionar clareza sobre gastos vs. orçamento.
- Acompanhar o crescimento do patrimônio líquido ao longo do tempo.
- Facilitar a tomada de decisão sobre investimentos e cortes de gastos.

## 3. Escopo do Produto

### 3.1. Funcionalidades Principais (Core Features)

#### Autenticação e Perfil
- Login seguro via e-mail e senha (integração Supabase Auth).
- Cadastro de novos usuários.
- Recuperação de senha (fluxo padrão Supabase).

#### Dashboard Principal
- Visão geral imediata com KPIs: Saldo Atual, Receitas do Mês, Despesas do Mês, Valor Investido.
- Gráfico de pizza para distribuição de despesas por categoria.
- Lista de transações recentes para consulta rápida.
- Atalhos para ações frequentes (Nova Transação).

#### Gestão de Transações
- **Listagem:** Visualização completa de todas as movimentações (Entradas, Saídas, Transferências).
- **Filtros:** Filtragem por mês/ano e tipo de transação.
- **CRUD:** Adicionar nova transação (com categoria, data, valor, descrição), Editar detalhes e Excluir lançamentos errados.
- **Validação:** Garantir que campos obrigatórios (valor, descrição, categoria) sejam preenchidos.

#### Controle de Orçamento (Budgets)
- Definir limites de gastos mensais por categoria (ex: Alimentação, Lazer, Moradia).
- Visualizar progresso do gasto em relação ao limite (barra de progresso).
- Alertas visuais quando o limite está próximo ou excedido.

#### Gestão de Patrimônio (Net Worth)
- Cadastro de Ativos (Investimentos, Imóveis, Veículos, Saldos em conta).
- Cadastro de Passivos (Dívidas, Financiamentos, Cartão de Crédito).
- Cálculo automático do Patrimônio Líquido (Ativos - Passivos).
- Histórico de evolução patrimonial.

#### Despesas Recorrentes
- Cadastro de contas fixas e assinaturas (Netflix, Aluguel, Internet).
- Visualização clara das datas de vencimento.
- Facilidade para lançar uma recorrência como transação efetivada no mês.

### 3.2. Requisitos Não Funcionais
- **Performance:** Carregamento rápido do dashboard (< 2s).
- **Segurança:** Dados sensíveis protegidos, comunicação via HTTPS, autenticação robusta.
- **Usabilidade:** Interface intuitiva (Mobile-first ou Responsiva), modo escuro/claro (tema).
- **Confiabilidade:** Cálculos precisos de saldo e totais.

## 4. Stack Tecnológica
- **Frontend:** Next.js 14+ (App Router), React, TypeScript.
- **Estilização:** Tailwind CSS, Shadcn/UI.
- **Backend/BaaS:** Supabase (PostgreSQL, Auth, Realtime).
- **State Management:** React Server Components + Server Actions (para mutações).
- **Validação:** Zod + React Hook Form.

## 5. Critérios de Aceite (Exemplos)
- O usuário deve conseguir logar e ver seus dados isolados de outros usuários.
- Ao adicionar uma despesa, o saldo e os totalizadores do dashboard devem atualizar instantaneamente (ou após refresh rápido).
- Não deve ser possível criar uma transação com valor negativo ou zero.
- O sistema deve tratar erros de conexão ou falhas na API graciosamente.
