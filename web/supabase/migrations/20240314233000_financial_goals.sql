
-- Tabela de Metas Financeiras (Potes/Buckets)
CREATE TABLE IF NOT EXISTS public.metas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL, -- Ex: "Reserva de Emergência", "Viagem 2027"
    valor_alvo NUMERIC(15, 2) NOT NULL, -- Quanto quero juntar (Ex: 10000.00)
    valor_atual NUMERIC(15, 2) DEFAULT 0, -- Quanto já tenho lá (Ex: 2000.00)
    data_limite DATE, -- Quando quero atingir essa meta (Opcional)
    cor TEXT DEFAULT '#10b981', -- Cor para gráficos (Opcional)
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_metas_updated_at
    BEFORE UPDATE ON public.metas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_metas_user ON public.metas(user_id);

-- Políticas de Segurança (RLS)
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver suas próprias metas"
    ON public.metas FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias metas"
    ON public.metas FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem editar suas próprias metas"
    ON public.metas FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias metas"
    ON public.metas FOR DELETE
    USING (auth.uid() = user_id);
