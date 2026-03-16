-- ==========================================
-- PERFORMANCE INDEXES (Otimização de Consultas)
-- ==========================================

-- 1. Transações: Buscas por Data e Categoria (Dashboard e Extrato)
CREATE INDEX IF NOT EXISTS idx_transacoes_user_data_tipo ON public.transacoes (user_id, data DESC, tipo);
CREATE INDEX IF NOT EXISTS idx_transacoes_user_categoria ON public.transacoes (user_id, categoria);
CREATE INDEX IF NOT EXISTS idx_transacoes_conta_id ON public.transacoes (conta_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_cartao_id ON public.transacoes (cartao_id);

-- 2. Recorrências: Buscas por Vencimento (Processamento Mensal)
CREATE INDEX IF NOT EXISTS idx_recorrentes_user_ativo ON public.recorrentes (user_id, ativo, dia_vencimento);

-- 3. Investimentos: Dashboard
CREATE INDEX IF NOT EXISTS idx_investimentos_user_ativo ON public.investimentos (user_id, ativo);

-- 4. Contas Bancárias
CREATE INDEX IF NOT EXISTS idx_contas_user ON public.contas_bancarias (user_id);
