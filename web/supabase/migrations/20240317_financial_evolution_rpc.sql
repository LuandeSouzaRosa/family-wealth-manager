-- ==========================================
-- FINANCIAL EVOLUTION RPC (Backend Logic)
-- ==========================================

CREATE OR REPLACE FUNCTION get_financial_evolution(p_months integer DEFAULT 6)
RETURNS TABLE (
  month_key text,
  total numeric
) AS $$
DECLARE
  v_user_id uuid;
  v_current_balance numeric;
BEGIN
  -- 1. Pega usuário atual (contexto RLS)
  v_user_id := auth.uid();
  
  -- 2. Pega Saldo Total Atual (Contas + Investimentos)
  SELECT 
    COALESCE((SELECT SUM(saldo_atual) FROM contas_bancarias WHERE user_id = v_user_id), 0) + 
    COALESCE((SELECT SUM(valor_atual) FROM investimentos WHERE user_id = v_user_id AND ativo = true), 0)
  INTO v_current_balance;

  -- 3. CTE Recursiva para calcular meses para trás
  RETURN QUERY
  WITH RECURSIVE months AS (
    -- Mês Atual (0)
    SELECT 
      0 as month_idx,
      date_trunc('month', CURRENT_DATE)::date as month_start,
      v_current_balance as balance_end_of_month
    UNION ALL
    -- Meses Anteriores
    SELECT 
      m.month_idx + 1,
      (m.month_start - interval '1 month')::date,
      -- O saldo no final do mês anterior é:
      -- Saldo(Fim Mês Atual) - (Entradas Mês Atual - Saídas Mês Atual)
      CAST(m.balance_end_of_month - (
        SELECT COALESCE(SUM(CASE WHEN tipo = 'Entrada' THEN valor ELSE -valor END), 0)
        FROM transacoes t
        WHERE t.user_id = v_user_id
        AND t.data >= m.month_start
        AND t.data < (m.month_start + interval '1 month')
      ) AS numeric)
    FROM months m
    WHERE m.month_idx < p_months - 1
  )
  SELECT 
    to_char(month_start, 'YYYY-MM') as month_key,
    ROUND(balance_end_of_month, 2) as total
  FROM months
  ORDER BY month_start ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissões
GRANT EXECUTE ON FUNCTION get_financial_evolution(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_financial_evolution(integer) TO service_role;
