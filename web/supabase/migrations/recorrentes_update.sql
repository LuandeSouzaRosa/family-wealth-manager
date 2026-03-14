-- ==========================================
-- RECORRENTES 2.0 - SUPABASE MIGRATION
-- Data: 2026-03-13
-- Objetivo: Suportar frequências variadas e controle de geração automática
-- ==========================================

-- 1. Adicionar novas colunas na tabela 'recorrentes'
ALTER TABLE public.recorrentes 
ADD COLUMN IF NOT EXISTS frequencia TEXT NOT NULL DEFAULT 'Mensal' CHECK (frequencia IN ('Mensal', 'Semanal', 'Anual', 'Quinzenal')),
ADD COLUMN IF NOT EXISTS ultima_geracao TIMESTAMPTZ, -- Data da última vez que gerou transação
ADD COLUMN IF NOT EXISTS data_fim TIMESTAMPTZ; -- Opcional: para parcelamentos (ex: 12x)

-- 2. Atualizar registros antigos para ter um padrão
UPDATE public.recorrentes SET frequencia = 'Mensal' WHERE frequencia IS NULL;

-- 3. Criar índice para buscar rapidamente o que precisa ser processado
CREATE INDEX IF NOT EXISTS idx_recorrentes_processamento ON public.recorrentes(user_id, ativo, ultima_geracao);
