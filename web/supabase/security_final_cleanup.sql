-- ==========================================
-- SECURITY: FINAL CLEANUP & HARDENING
-- Data: 2026-03-13
-- Descrição: Este script complementa as migrações anteriores, garantindo
-- performance (índices) e segurança (permissões), sem conflitar com o RLS de Família.
-- ==========================================

-- 1. LIMPEZA DE POLICIES ANTIGAS (Evita conflitos e confusão)
-- Como rodamos o "couple_view", as policies ativas devem ser as "_Family".
-- Vamos remover as versões simples para não ter duplicidade.

DROP POLICY IF EXISTS "Transacoes_SELECT" ON public.transacoes;
DROP POLICY IF EXISTS "Transacoes_INSERT" ON public.transacoes;
DROP POLICY IF EXISTS "Transacoes_UPDATE" ON public.transacoes;
DROP POLICY IF EXISTS "Transacoes_DELETE" ON public.transacoes;

DROP POLICY IF EXISTS "Recorrentes_SELECT" ON public.recorrentes;
DROP POLICY IF EXISTS "Recorrentes_INSERT" ON public.recorrentes;
DROP POLICY IF EXISTS "Recorrentes_UPDATE" ON public.recorrentes;
DROP POLICY IF EXISTS "Recorrentes_DELETE" ON public.recorrentes;

DROP POLICY IF EXISTS "Orcamentos_SELECT" ON public.orcamentos;
DROP POLICY IF EXISTS "Orcamentos_INSERT" ON public.orcamentos;
DROP POLICY IF EXISTS "Orcamentos_UPDATE" ON public.orcamentos;
DROP POLICY IF EXISTS "Orcamentos_DELETE" ON public.orcamentos;

DROP POLICY IF EXISTS "Patrimonio_SELECT" ON public.patrimonio;
DROP POLICY IF EXISTS "Patrimonio_INSERT" ON public.patrimonio;
DROP POLICY IF EXISTS "Patrimonio_UPDATE" ON public.patrimonio;
DROP POLICY IF EXISTS "Patrimonio_DELETE" ON public.patrimonio;


-- 2. PROTEÇÃO DE VIEWS (Security Invoker)
-- Garante que as views respeitem o RLS do usuário logado.
-- (Seguro de rodar múltiplas vezes)

ALTER VIEW public.vw_mes_atual_metricas SET (security_invoker = on);
ALTER VIEW public.vw_categoria_breakdown SET (security_invoker = on);
ALTER VIEW public.vw_orcamento_status SET (security_invoker = on);
-- A view vw_503020_analysis já foi tratada no script couple_view.


-- 3. ÍNDICES DE PERFORMANCE (Anti-DoS)
-- Acelera queries filtradas por usuário, protegendo o banco de sobrecarga.

CREATE INDEX IF NOT EXISTS idx_transacoes_user_data ON public.transacoes(user_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_transacoes_categoria ON public.transacoes(user_id, categoria);
CREATE INDEX IF NOT EXISTS idx_recorrentes_user ON public.recorrentes(user_id);


-- 4. HARDENING DE PERMISSÕES (Princípio do Menor Privilégio)
-- Garante que usuários não logados (anon) não acessem nada.

REVOKE ALL ON public.transacoes FROM anon;
REVOKE ALL ON public.recorrentes FROM anon;
REVOKE ALL ON public.orcamentos FROM anon;
REVOKE ALL ON public.patrimonio FROM anon;

-- Garante acesso aos usuários logados (respeitando o RLS)
GRANT ALL ON public.transacoes TO authenticated;
GRANT ALL ON public.recorrentes TO authenticated;
GRANT ALL ON public.orcamentos TO authenticated;
GRANT ALL ON public.patrimonio TO authenticated;
