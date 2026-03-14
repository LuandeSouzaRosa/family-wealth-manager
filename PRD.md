# PRD - Family Wealth Manager (v6.0 - Web/Next.js)

## 1. Visão Geral
O **Family Wealth Manager** é um ecossistema completo de gestão financeira pessoal e familiar. Nesta versão (v6.0 - pós Fases 12 e 13), a aplicação concluiu sua migração de Python/Streamlit para uma arquitetura web moderna utilizando **Next.js** e **Supabase**. O objetivo permanece o mesmo: fornecer uma visão clara, analítica e acionável da saúde financeira, baseada em metodologias como a regra 50/30/20, mas agora com uma experiência de usuário imersiva, rápida e escalável baseada em web.

## 2. Objetivos Principais
- **Centralização Escalável**: Armazenamento baseado em banco de dados relacional (PostgreSQL via Supabase), garantindo integridade e velocidade.
- **Segurança e Autenticação**: Autenticação baseada em sessão (Supabase Auth) permitindo controles de acesso granulares (RLS - Row Level Security) para segurança e isolamento.
- **Experiência de Usuário Moderna**: Interface reativa e elegante desenvolvida com React, Tailwind CSS 4, Shadcn UI e Framer Motion.
- **Motor Analítico no Banco de Dados**: Cálculos complexos transferidos para Views e Functions no PostgreSQL, otimizando o carregamento dos dashboards.

## 3. Personas e Público-Alvo
- **Usuário Individual**: Focado em controlar rigorosamente seus gastos com uma ferramenta que carrega instantaneamente no celular ou computador.
- **Família (Casais)**: Usuários que compartilham finanças e desejam visões de gastos unificadas de forma transparente, com perfis autenticados.

## 4. Requisitos Funcionais (Fases Concluídas)

### 4.1 Autenticação e Perfis
- **Login e Registro Seguro**: Integração completa com Supabase Auth (Magic Links ou Email/Senha).
- **Isolamento de Dados**: Utilização de Row Level Security (RLS) para assegurar que os usuários acessem somente os próprios dados.

### 4.2 Dashboard Interativo e Métricas Core
- **Indicadores de Desempenho (KPIs)**: Cards em tempo real exibindo Saldo Restante, Total de Receitas, Despesas de Lifestyle e Total Investido.
- **Gráficos Dinâmicos**: Integração do Recharts para representar o fluxo de despesas (Pie Chart) e evolução.
- **Transações Recentes**: Feed de transações diretamente na tela inicial com design limpo.

### 4.3 Gestão de Movimentações (Dashboard e Histórico)
- **Painel de Inserção**: Modal centralizado e dinâmico (`AddTransactionDialog`) para entrada rápida de receitas, despesas e investimentos.
- **Histórico Completo (Fase 12+)**: Aba `/transacoes` com filtros de mês/ano, resumo do período e função de deleção de lançamentos.
- **Custos Fixos / Recorrentes**: Gerenciamento de despesas fixas mensais na rota `/recorrentes`, com ativação/desativação (toggle) e deleção.
- **Categorização Intuitiva**: Suporte a tags e separação rígida de natureza (`Entrada` versus `Saída`), Lifestyle vs Investimentos.

### 4.4 Orçamentos e Monitoramento
- **Gerenciamento de Budgets**: Limites fixos customizáveis (`orcamentos`) por categoria na rota `/orcamentos`.
- **Status em Tempo Real**: Barras de progresso animadas combinando consumo atual vs orçado.

### 4.5 Gestão Patrimonial
- **Bens e Valores Acumulados**: Gestão de patrimônio via rota `/patrimonio` para consolidação do net-worth (Ativos e Passivos).

## 5. Requisitos Técnicos e Arquitetura

### 5.1 Tech Stack (Fases 10 a 13 - Web Migration Completa)
- **Frontend/Framework**: Next.js 15 (App Router, React Server Components via SSR).
- **Estilização/UI**: Tailwind CSS 4, Shadcn UI, Framer Motion para animações e ícones Lucide.
- **Backend/BaaS**: Supabase (PostgreSQL 15+, Auth, RLS).
- **Linguagem**: TypeScript rigoroso incluindo Zod para esquemas de validação.

### 5.2 Arquitetura de Software
- **`web/src/app`**: Estrutura orientada a rotas (`/login`, `/`, `/transacoes`, `/orcamentos`, `/recorrentes`, `/patrimonio`).
- **`web/src/components`**: Componentes reutilizáveis (gráficos, diálogos, métricas).
- **`web/src/actions`**: Server Actions do Next.js lidando com mutações e interações com Supabase no servidor.
- **`web/supabase`**: Armazena as views SQL otimizadas (`vw_mes_atual_metricas`, etc.).

## 6. Futuros Desenvolvimentos (Roadmap Atualizado)
- [ ] Construir a aba de gerenciamento detalhado das Visões 50/30/20 e Autonomia Financeira.
- [ ] Refinar as políticas de compartilhamento para o módulo 'Casal' com cross-reading seguro.
- [ ] Otimização para Transformação em PWA (Progressive Web App) garantindo cache offline básico.
- [ ] Implementação total da Suíte de Testes (Em andamento: TestSprite / E2E).
