-- 1. Tabela de Cartões de Crédito
CREATE TABLE IF NOT EXISTS public.cartoes_credito (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    limite NUMERIC(12, 2) NOT NULL DEFAULT 0,
    dia_fechamento INTEGER NOT NULL CHECK (dia_fechamento BETWEEN 1 AND 31),
    dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
    cor TEXT DEFAULT '#000000',
    responsavel TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.cartoes_credito ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cartoes do proprio usuario" ON public.cartoes_credito FOR ALL USING (auth.uid() = user_id);

-- 2. Vincular Transações a Cartões
ALTER TABLE public.transacoes ADD COLUMN IF NOT EXISTS cartao_id UUID REFERENCES public.cartoes_credito(id) ON DELETE SET NULL;
