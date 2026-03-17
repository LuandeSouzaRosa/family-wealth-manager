-- ==========================================
-- FAMILY WEALTH MANAGER - PERFORMANCE INDEXES
-- P1.4: Índices para otimização de queries principais
-- ==========================================
-- 
-- Safe to run multiple times (IF NOT EXISTS).
-- Does NOT use CONCURRENTLY (not supported inside transactions
-- on Supabase SQL Editor). For a production DB with heavy traffic,
-- run each CREATE INDEX CONCURRENTLY separately outside a transaction.
-- ==========================================

-- =================================================================================
-- 1. TRANSAÇÕES
-- =================================================================================

-- 1a. Índice principal: filtro por mês (feature mais usada do sistema)
-- Usado por: getTransactions(month, year), vw_mes_atual_metricas, 
--            vw_categoria_breakdown, getFinancialEvolution, getRecentTransactions
CREATE INDEX IF NOT EXISTS idx_transacoes_user_data
    ON public.transacoes (user_id, data DESC);

-- 1b. Breakdown por categoria (gráfico de rosca, orçamento vs gasto)
-- Usado por: vw_categoria_breakdown, vw_orcamento_status, get503020Metrics
CREATE INDEX IF NOT EXISTS idx_transacoes_user_categoria_data
    ON public.transacoes (user_id, categoria, data);

-- 1c. Fatura de cartão de crédito (filtro por cartao_id + período)
-- Usado por: calcularFaturaAtual() — chamada N vezes por getCartoesCredito()
-- Partial index: só transações vinculadas a cartão
CREATE INDEX IF NOT EXISTS idx_transacoes_cartao
    ON public.transacoes (cartao_id, data)
    WHERE cartao_id IS NOT NULL;

-- 1d. Transações por conta bancária
-- Usado por: filtros de extrato por conta, conciliação bancária
-- Partial index: só transações vinculadas a conta
CREATE INDEX IF NOT EXISTS idx_transacoes_conta
    ON public.transacoes (conta_id, data)
    WHERE conta_id IS NOT NULL;

-- 1e. Deduplicação Pluggy (upsert on conflict)
-- Usado por: syncPluggyTransactions, syncFromWebhook
-- Partial index: só transações do Open Banking
CREATE INDEX IF NOT EXISTS idx_transacoes_pluggy_id
    ON public.transacoes (pluggy_transaction_id)
    WHERE pluggy_transaction_id IS NOT NULL;

-- =================================================================================
-- 2. RECORRENTES
-- =================================================================================

-- 2a. Processamento mensal de recorrências ativas
-- Usado por: processarRecorrencias(), getCashFlowForecast()
-- Partial index: só recorrências ativas (a maioria das consultas filtra ativo=true)
CREATE INDEX IF NOT EXISTS idx_recorrentes_user_ativo
    ON public.recorrentes (user_id, ativo)
    WHERE ativo = true;

-- =================================================================================
-- 3. INVESTIMENTOS
-- =================================================================================

-- 3a. Listagem de investimentos ativos
-- Usado por: getInvestimentos(), getFinancialHealthMetrics()
-- Partial index: só investimentos ativos
CREATE INDEX IF NOT EXISTS idx_investimentos_user_ativo
    ON public.investimentos (user_id, ativo)
    WHERE ativo = true;
