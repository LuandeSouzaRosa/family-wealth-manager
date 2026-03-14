-- ==========================================
-- SECURITY: RLS FIX FOR RECORRENTES & ORCAMENTOS
-- Data: 2026-03-13
-- Descrição: Corrige o problema onde usuários autenticados não conseguiam
-- criar (INSERT) ou deletar registros nestas tabelas devido à falta de policies.
-- ==========================================

-- 1. RECORRENTES
-- ==========================================

-- Permitir INSERT para o próprio usuário
DROP POLICY IF EXISTS "Recorrentes_INSERT_Family" ON public.recorrentes;
CREATE POLICY "Recorrentes_INSERT_Family" ON public.recorrentes 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Permitir UPDATE para membros da família (ou apenas dono, configurável)
DROP POLICY IF EXISTS "Recorrentes_UPDATE_Family" ON public.recorrentes;
CREATE POLICY "Recorrentes_UPDATE_Family" ON public.recorrentes 
    FOR UPDATE USING (public.is_same_family(user_id));

-- Permitir DELETE para membros da família
DROP POLICY IF EXISTS "Recorrentes_DELETE_Family" ON public.recorrentes;
CREATE POLICY "Recorrentes_DELETE_Family" ON public.recorrentes 
    FOR DELETE USING (public.is_same_family(user_id));


-- 2. ORÇAMENTOS
-- ==========================================

-- Permitir INSERT para o próprio usuário
DROP POLICY IF EXISTS "Orcamentos_INSERT_Family" ON public.orcamentos;
CREATE POLICY "Orcamentos_INSERT_Family" ON public.orcamentos 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Permitir UPDATE
DROP POLICY IF EXISTS "Orcamentos_UPDATE_Family" ON public.orcamentos;
CREATE POLICY "Orcamentos_UPDATE_Family" ON public.orcamentos 
    FOR UPDATE USING (public.is_same_family(user_id));

-- Permitir DELETE
DROP POLICY IF EXISTS "Orcamentos_DELETE_Family" ON public.orcamentos;
CREATE POLICY "Orcamentos_DELETE_Family" ON public.orcamentos 
    FOR DELETE USING (public.is_same_family(user_id));


-- 3. PATRIMÔNIO (Garantir consistência também)
-- ==========================================

DROP POLICY IF EXISTS "Patrimonio_INSERT_Family" ON public.patrimonio;
CREATE POLICY "Patrimonio_INSERT_Family" ON public.patrimonio 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Patrimonio_UPDATE_Family" ON public.patrimonio;
CREATE POLICY "Patrimonio_UPDATE_Family" ON public.patrimonio 
    FOR UPDATE USING (public.is_same_family(user_id));

DROP POLICY IF EXISTS "Patrimonio_DELETE_Family" ON public.patrimonio;
CREATE POLICY "Patrimonio_DELETE_Family" ON public.patrimonio 
    FOR DELETE USING (public.is_same_family(user_id));
