-- ==========================================
-- REPARO DE ESTRUTURA: ORÇAMENTOS
-- ==========================================

-- 1. Garantir que a tabela orcamentos tenha a coluna correta 'valor_limite'
DO $$
BEGIN
    -- Se existir coluna 'limite', renomeia para 'valor_limite'
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orcamentos' AND column_name = 'limite') THEN
        ALTER TABLE public.orcamentos RENAME COLUMN limite TO valor_limite;
    END IF;

    -- Se não existir 'valor_limite' nem 'limite', adiciona 'valor_limite'
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orcamentos' AND column_name = 'valor_limite') THEN
        ALTER TABLE public.orcamentos ADD COLUMN valor_limite NUMERIC(15, 2) DEFAULT 0 NOT NULL;
    END IF;
END $$;

-- 2. Recriar a View com a coluna correta
DROP VIEW IF EXISTS public.vw_orcamento_status;

CREATE OR REPLACE VIEW public.vw_orcamento_status AS
SELECT 
    o.id as orcamento_id,
    o.categoria,
    o.valor_limite as limite,
    o.user_id,
    COALESCE(SUM(t.valor), 0) as gasto_atual
FROM 
    public.orcamentos o
LEFT JOIN 
    public.transacoes t ON t.categoria = o.categoria 
    AND t.user_id = o.user_id 
    AND t.tipo = 'Saída'
    AND (t.status = 'Realizado' OR t.status IS NULL) -- Compatibilidade com dados antigos
    AND t.data >= date_trunc('month', CURRENT_DATE)
    AND t.data < date_trunc('month', CURRENT_DATE) + interval '1 month'
GROUP BY 
    o.id, o.categoria, o.valor_limite, o.user_id;

-- Permissões
GRANT SELECT ON public.vw_orcamento_status TO authenticated;
GRANT SELECT ON public.vw_orcamento_status TO service_role;
