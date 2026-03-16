-- ==========================================
-- MÓDULO DE INVESTIMENTOS (XP e outros)
-- ==========================================

-- 1. Tabela de Investimentos
CREATE TABLE IF NOT EXISTS public.investimentos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL, -- Ex: "CDB Banco Master", "PETR4"
    tipo TEXT NOT NULL, -- Ex: "Renda Fixa", "Ação", "FII", "Fundo", "Tesouro", "Previdência", "Cripto"
    instituicao TEXT DEFAULT 'XP', -- Ex: "XP", "Nubank", "Inter"
    
    -- Valores
    valor_aplicado NUMERIC(15, 2) NOT NULL, -- Quanto saiu do bolso (Custo)
    valor_atual NUMERIC(15, 2) NOT NULL, -- Quanto vale hoje (Mercado)
    quantidade NUMERIC(15, 8) DEFAULT 1, -- Para Ações/Cripto. Renda Fixa pode ser 1.
    
    -- Datas
    data_aplicacao DATE DEFAULT CURRENT_DATE NOT NULL,
    data_vencimento DATE, -- Opcional (para RF)
    liquidez TEXT, -- Ex: "D+0", "No Vencimento", "D+30"
    
    -- Controle
    responsavel TEXT NOT NULL DEFAULT 'Casal', -- "Luan", "Luana", "Casal"
    ativo BOOLEAN DEFAULT TRUE, -- Se foi resgatado vira FALSE
    
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger para updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_investimentos_updated_at') THEN
        CREATE TRIGGER update_investimentos_updated_at
            BEFORE UPDATE ON public.investimentos
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- RLS
ALTER TABLE public.investimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem ver seus próprios investimentos" ON public.investimentos;
CREATE POLICY "Usuários podem ver seus próprios investimentos" ON public.investimentos FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem gerenciar seus próprios investimentos" ON public.investimentos;
CREATE POLICY "Usuários podem gerenciar seus próprios investimentos" ON public.investimentos FOR ALL USING (auth.uid() = user_id);
