
-- Tabela para armazenar regras de categorização automática
CREATE TABLE IF NOT EXISTS public.regras_categorizacao (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    texto_contem TEXT NOT NULL, -- Ex: "Uber", "Ifood", "Posto"
    categoria_destino TEXT NOT NULL, -- Ex: "Transporte", "Alimentação"
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_regras_user ON public.regras_categorizacao(user_id);

-- Políticas de Segurança (RLS)
ALTER TABLE public.regras_categorizacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver suas próprias regras"
    ON public.regras_categorizacao FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias regras"
    ON public.regras_categorizacao FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem editar suas próprias regras"
    ON public.regras_categorizacao FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias regras"
    ON public.regras_categorizacao FOR DELETE
    USING (auth.uid() = user_id);
