-- ==========================================
-- SECURITY PATCH & PERFORMANCE TUNING
-- Data: 2026-03-13
-- Autor: Trae AI (Security Audit)
-- ==========================================

-- 1. REFORÇO DE RLS (Row Level Security)
-- O modelo anterior usava apenas "USING", o que protege SELECTs e DELETEs,
-- mas não valida totalmente INSERTs/UPDATEs contra injeção de user_id falso.

-- Transações
DROP POLICY IF EXISTS "Transacoes do proprio usuario" ON public.transacoes;

CREATE POLICY "Transacoes_SELECT" ON public.transacoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Transacoes_INSERT" ON public.transacoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Transacoes_UPDATE" ON public.transacoes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Transacoes_DELETE" ON public.transacoes FOR DELETE USING (auth.uid() = user_id);

-- Recorrentes
DROP POLICY IF EXISTS "Recorrentes do proprio usuario" ON public.recorrentes;

CREATE POLICY "Recorrentes_SELECT" ON public.recorrentes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Recorrentes_INSERT" ON public.recorrentes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Recorrentes_UPDATE" ON public.recorrentes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Recorrentes_DELETE" ON public.recorrentes FOR DELETE USING (auth.uid() = user_id);

-- Orçamentos
DROP POLICY IF EXISTS "Orcamentos do proprio usuario" ON public.orcamentos;

CREATE POLICY "Orcamentos_SELECT" ON public.orcamentos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Orcamentos_INSERT" ON public.orcamentos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Orcamentos_UPDATE" ON public.orcamentos FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Orcamentos_DELETE" ON public.orcamentos FOR DELETE USING (auth.uid() = user_id);

-- Patrimônio
DROP POLICY IF EXISTS "Patrimonio do proprio usuario" ON public.patrimonio;

CREATE POLICY "Patrimonio_SELECT" ON public.patrimonio FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Patrimonio_INSERT" ON public.patrimonio FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Patrimonio_UPDATE" ON public.patrimonio FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Patrimonio_DELETE" ON public.patrimonio FOR DELETE USING (auth.uid() = user_id);


-- 2. PROTEÇÃO DE VIEWS (Security Invoker)
-- Isso força a View a usar as permissões do usuário que está chamando (Invoker),
-- garantindo que o RLS das tabelas base seja respeitado.

ALTER VIEW public.vw_mes_atual_metricas SET (security_invoker = on);
ALTER VIEW public.vw_categoria_breakdown SET (security_invoker = on);
ALTER VIEW public.vw_orcamento_status SET (security_invoker = on);


-- 3. ÍNDICES DE PERFORMANCE (Anti-DoS)
-- Acelera queries filtradas por usuário e data, reduzindo carga na CPU do banco.

CREATE INDEX IF NOT EXISTS idx_transacoes_user_data ON public.transacoes(user_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_transacoes_categoria ON public.transacoes(user_id, categoria);
CREATE INDEX IF NOT EXISTS idx_recorrentes_user ON public.recorrentes(user_id);

-- 4. HARDENING ADICIONAL
-- Revoga permissões públicas desnecessárias (Princípio do Menor Privilégio)
REVOKE ALL ON public.transacoes FROM anon;
REVOKE ALL ON public.recorrentes FROM anon;
REVOKE ALL ON public.orcamentos FROM anon;
REVOKE ALL ON public.patrimonio FROM anon;
-- 'authenticated' precisa de acesso total (respeitando RLS)
GRANT ALL ON public.transacoes TO authenticated;
GRANT ALL ON public.recorrentes TO authenticated;
GRANT ALL ON public.orcamentos TO authenticated;
GRANT ALL ON public.patrimonio TO authenticated;
