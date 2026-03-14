-- ==========================================
-- FAMILY WEALTH MANAGER - SUPABASE SCHEMA
-- Fase 10: Migração do Cérebro Python para SQL
-- ==========================================

-- 1. Habilitando a extensão de UUID (se aplicável)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =================================================================================
-- TABELAS PRINCIPAIS
-- =================================================================================

-- 1. Transações (O fluxo de caixa principal)
CREATE TABLE IF NOT EXISTS public.transacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data TIMESTAMPTZ NOT NULL DEFAULT now(),
    descricao TEXT NOT NULL,
    valor NUMERIC(12, 2) NOT NULL DEFAULT 0,
    categoria TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('Entrada', 'Saída')),
    responsavel TEXT NOT NULL,
    origem TEXT NOT NULL DEFAULT 'Manual',
    tag TEXT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitando RLS (Apenas donos veem seu próprio dinheiro)
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Transacoes do proprio usuario" ON public.transacoes FOR ALL USING (auth.uid() = user_id);


-- 2. Patrimônio (Bens, ativos estáticos, saldos base)
CREATE TABLE IF NOT EXISTS public.patrimonio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item TEXT NOT NULL,
    valor NUMERIC(12, 2) NOT NULL DEFAULT 0,
    responsavel TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.patrimonio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patrimonio do proprio usuario" ON public.patrimonio FOR ALL USING (auth.uid() = user_id);


-- 3. Transações Recorrentes (Contas fixas mensais)
CREATE TABLE IF NOT EXISTS public.recorrentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    descricao TEXT NOT NULL,
    valor NUMERIC(12, 2) NOT NULL DEFAULT 0,
    categoria TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('Entrada', 'Saída')),
    responsavel TEXT NOT NULL,
    dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
    ativo BOOLEAN NOT NULL DEFAULT true,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.recorrentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recorrentes do proprio usuario" ON public.recorrentes FOR ALL USING (auth.uid() = user_id);


-- 4. Orçamentos (Limites de gastos por categoria)
CREATE TABLE IF NOT EXISTS public.orcamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria TEXT NOT NULL,
    limite NUMERIC(12, 2) NOT NULL DEFAULT 0,
    responsavel TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    UNIQUE(categoria, responsavel, user_id)
);

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Orcamentos do proprio usuario" ON public.orcamentos FOR ALL USING (auth.uid() = user_id);


-- =================================================================================
-- MOTOR ANALÍTICO (VIEWS) -- Substituindo o antigo core/engine.py
-- =================================================================================

-- VIEW 1: Métricas Principais por Mês
-- Filtra Entradas, Despesas Livres (Lifestyle) e Investimentos agrupando por Mês e Usuário.
CREATE OR REPLACE VIEW public.vw_mes_atual_metricas AS
SELECT 
    user_id,
    date_trunc('month', data) AS mes_ref,
    COALESCE(SUM(CASE WHEN tipo = 'Entrada' THEN valor ELSE 0 END), 0) as renda,
    COALESCE(SUM(CASE WHEN tipo = 'Saída' AND categoria != 'Investimento' THEN valor ELSE 0 END), 0) as despesas,
    COALESCE(SUM(CASE WHEN tipo = 'Saída' AND categoria = 'Investimento' THEN valor ELSE 0 END), 0) as investido
FROM public.transacoes
GROUP BY user_id, date_trunc('month', data);


-- VIEW 2: Agrupamento por Categoria (Breakdown de Gastos)
-- Substitui os longos pivotes de dataframes Pandas para montar o gráfico de Rosca
CREATE OR REPLACE VIEW public.vw_categoria_breakdown AS
SELECT 
    user_id,
    date_trunc('month', data) AS mes_ref,
    categoria,
    SUM(valor) as total
FROM public.transacoes
WHERE tipo = 'Saída' AND categoria != 'Investimento'
GROUP BY user_id, date_trunc('month', data), categoria;


-- VIEW 3: Comparativo Orçamento vs Gasto Real
-- Junta limites cadastrados com o valor gasto no mês recorrente
CREATE OR REPLACE VIEW public.vw_orcamento_status AS
SELECT 
    o.user_id,
    o.categoria,
    o.limite,
    COALESCE(g.gasto, 0) AS gasto_atual,
    CASE WHEN o.limite > 0 THEN (COALESCE(g.gasto, 0) / o.limite) * 100 ELSE 0 END AS pct_consumido
FROM public.orcamentos o
LEFT JOIN (
    SELECT user_id, categoria, SUM(valor) as gasto
    FROM public.transacoes
    WHERE date_trunc('month', data) = date_trunc('month', CURRENT_DATE) 
      AND tipo = 'Saída'
    GROUP BY user_id, categoria
) g ON o.user_id = g.user_id AND o.categoria = g.categoria;
