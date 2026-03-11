# PRD - Family Wealth Manager (v4.0)

## 1. Visão Geral
O **Family Wealth Manager** é um ecossistema de gestão financeira pessoal e familiar desenvolvido em Python com Streamlit. Seu objetivo principal é fornecer uma visão clara, analítica e acionável da saúde financeira, baseando-se em metodologias consagradas como a regra 50/30/20 e o cálculo de autonomia financeira.

## 2. Objetivos Principais
- **Centralização**: Consolidar gastos, rendas e patrimônio em um único local.
- **Análise Inteligente**: Ir além de simples planilhas, oferecendo scores financeiros, alertas de orçamento e projeções de fechamento de mês.
- **Flexibilidade Familiar**: Permitir visões individuais ('Luan', 'Luana') e a visão consolidada ('Casal').

## 3. Personas e Público-Alvo
- **Usuário Individual**: Focado em controlar seus gastos pessoais e investimentos.
- **Família (Casal)**: Focada em entender o impacto dos gastos conjuntos na renda total e planejar o patrimônio compartilhado.

## 4. Requisitos Funcionais

### 4.1 Dashboard e Métricas Core
- **Escore Financeiro (0-100)**: Avaliação da saúde financeira baseada em 4 pilares: Aderência à Regra 50/30/20, Taxa de Aporte, Autonomia e Saldo Mensal.
- **Regra 50/30/20**: Monitoramento automático de despesas em Necessidades (Meta: 50%), Desejos (Meta: 30%) e Investimentos (Meta: 20%).
- **Autonomia Financeira**: Cálculo de quantos meses de vida o patrimônio atual cobre, baseado na média de gastos dos últimos 3 meses.
- **Saúde Financeira**: Classificação qualitativa (Excelente, Saudável, Atenção, Crítico).

### 4.2 Gestão de Movimentações
- **Lançamentos Manuais**: Registro de entradas (renda) e saídas (lifestyle/investimentos).
- **Transações Recorrentes (Fixos)**: Sistema para detectar e gerar automaticamente contas fixas mensais.
- **Categorização Inteligente**: Separação entre Gastos Essenciais, Estilo de Vida e Investimentos.

### 4.3 Gestão de Patrimônio
- **Saldos Iniciais**: Registro de saldos em contas e corretoras.
- **Bens Duráveis**: Controle de ativos fixos que compõem o patrimônio total.

### 4.4 Inteligência e Alertas
- **Projeção de Fim de Mês**: Cálculo linear baseado no consumo atual para prever se o mês fechará no positivo.
- **Alertas de Budget**: Notificações automáticas quando categorias de orçamento ultrapassam 80% ou 100% do limite.
- **Insights Contextuais**: Destaque para o maior impacto de gasto no mês e variação percentual em relação ao mês anterior (Deltas).

## 5. Requisitos Técnicos

### 5.1 Tech Stack
- **Linguagem**: Python 3.x
- **Frontend/UI**: Streamlit
- **Processamento de Dados**: Pandas (Motor Analítico)
- **Armazenamento**:
    - Suporte a **Google Sheets** (via API) para facilidade de edição externa.
    - Suporte a **Supabase** para persistência escalável e relacional.

### 5.2 Arquitetura (Modularizada)
- `core/engine.py`: Funções puras para cálculos financeiros e métricas.
- `core/models.py`: Dataclasses que definem as estruturas de dados (ex: `MonthMetrics`).
- `core/views.py`: Lógica de renderização de componentes visuais do Streamlit.
- `core/repository.py`: Interface para abstração da camada de dados.

## 6. Futuros Desenvolvimentos (Roadmap)
- [ ] Integração com Open Banking (via Pluggy ou similar).
- [ ] Dashboard de Investimentos detalhado com rentabilidade de ativos.
- [ ] Aplicativo Mobile nativo ou PWA avançado.
- [ ] IA para sugestão de economia baseada no histórico de consumo.
