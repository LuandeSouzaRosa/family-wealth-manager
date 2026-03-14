
-- Limpar dados das tabelas (mantendo estrutura)
TRUNCATE TABLE public.transacoes CASCADE;
TRUNCATE TABLE public.recorrentes CASCADE;
TRUNCATE TABLE public.orcamentos CASCADE;
TRUNCATE TABLE public.patrimonio CASCADE;

-- Resetar views se necessário (opcional, pois views são consultas em tempo real)
