-- =================================================================================================
-- AUDITORIA DE SEGURANÇA: REFORÇO DE RLS (Row Level Security)
-- =================================================================================================
-- Este script garante que TODAS as tabelas do sistema tenham RLS habilitado e políticas corretas.
-- Ele é idempotente (pode ser rodado várias vezes sem erro).

-- 1. Transações
ALTER TABLE IF EXISTS public.transacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own transacoes" ON public.transacoes;
DROP POLICY IF EXISTS "Users can insert own transacoes" ON public.transacoes;
DROP POLICY IF EXISTS "Users can update own transacoes" ON public.transacoes;
DROP POLICY IF EXISTS "Users can delete own transacoes" ON public.transacoes;

CREATE POLICY "Users can view own transacoes" ON public.transacoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transacoes" ON public.transacoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transacoes" ON public.transacoes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transacoes" ON public.transacoes FOR DELETE USING (auth.uid() = user_id);

-- 2. Contas Bancárias
ALTER TABLE IF EXISTS public.contas_bancarias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own contas" ON public.contas_bancarias;
CREATE POLICY "Users can view own contas" ON public.contas_bancarias FOR ALL USING (auth.uid() = user_id);

-- 3. Cartões de Crédito
ALTER TABLE IF EXISTS public.cartoes_credito ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own cartoes" ON public.cartoes_credito;
CREATE POLICY "Users can view own cartoes" ON public.cartoes_credito FOR ALL USING (auth.uid() = user_id);

-- 4. Investimentos
ALTER TABLE IF EXISTS public.investimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own investimentos" ON public.investimentos;
CREATE POLICY "Users can view own investimentos" ON public.investimentos FOR ALL USING (auth.uid() = user_id);

-- 5. Metas
ALTER TABLE IF EXISTS public.metas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own metas" ON public.metas;
CREATE POLICY "Users can view own metas" ON public.metas FOR ALL USING (auth.uid() = user_id);

-- 6. Recorrências
ALTER TABLE IF EXISTS public.recorrentes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own recorrentes" ON public.recorrentes;
CREATE POLICY "Users can view own recorrentes" ON public.recorrentes FOR ALL USING (auth.uid() = user_id);

-- 7. Patrimônio
ALTER TABLE IF EXISTS public.patrimonio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own patrimonio" ON public.patrimonio;
CREATE POLICY "Users can view own patrimonio" ON public.patrimonio FOR ALL USING (auth.uid() = user_id);

-- 8. Orçamentos
ALTER TABLE IF EXISTS public.orcamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own orcamentos" ON public.orcamentos;
CREATE POLICY "Users can view own orcamentos" ON public.orcamentos FOR ALL USING (auth.uid() = user_id);

-- 9. Regras de Categorização
ALTER TABLE IF EXISTS public.regras_categorizacao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own regras" ON public.regras_categorizacao;
CREATE POLICY "Users can view own regras" ON public.regras_categorizacao FOR ALL USING (auth.uid() = user_id);

-- 10. Perfis (Profiles) - Se existir
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Confirmação visual
DO $$
BEGIN
    RAISE NOTICE 'RLS habilitado e políticas aplicadas para todas as tabelas críticas.';
END $$;
