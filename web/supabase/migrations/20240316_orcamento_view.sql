-- ==========================================
-- VIEW: STATUS DOS ORÇAMENTOS (Gasto vs Limite)
-- ==========================================

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
    AND t.status = 'Realizado' -- Apenas gastos reais contam para o limite
    AND t.data >= date_trunc('month', CURRENT_DATE)
    AND t.data < date_trunc('month', CURRENT_DATE) + interval '1 month'
GROUP BY 
    o.id, o.categoria, o.valor_limite, o.user_id;

-- Permissões
GRANT SELECT ON public.vw_orcamento_status TO authenticated;
GRANT SELECT ON public.vw_orcamento_status TO service_role;
