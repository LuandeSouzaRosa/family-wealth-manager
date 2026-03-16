-- ==========================================
-- CATEGORIAS DINÂMICAS
-- ==========================================

-- 1. Criar a tabela de categorias
CREATE TABLE IF NOT EXISTS public.categorias (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    nome text NOT NULL,
    tipo text CHECK (tipo IN ('Entrada', 'Saída', 'Ambos')) DEFAULT 'Ambos',
    cor text DEFAULT '#64748b', -- Slate 500 como default
    icone text DEFAULT 'tag', -- Nome do ícone Lucide
    created_at timestamptz DEFAULT now()
);

-- 2. Restrição para não haver categorias com o mesmo nome para o mesmo usuário e tipo
ALTER TABLE public.categorias ADD CONSTRAINT unique_nome_tipo_user UNIQUE (user_id, nome, tipo);

-- 3. Habilitar RLS
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own categorias" 
ON public.categorias FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categorias" 
ON public.categorias FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categorias" 
ON public.categorias FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categorias" 
ON public.categorias FOR DELETE 
USING (auth.uid() = user_id);

-- 4. Inserir Categorias Padrão (Gatilho ao criar usuário - Opcional, mas faremos via código para usuários existentes)
-- Aqui inserimos um conjunto padrão para quem já está no sistema
DO $$
DECLARE
    usr RECORD;
BEGIN
    FOR usr IN SELECT DISTINCT user_id FROM public.transacoes LOOP
        -- Entradas
        INSERT INTO public.categorias (user_id, nome, tipo, cor, icone) VALUES
        (usr.user_id, 'Salário', 'Entrada', '#10b981', 'briefcase'),
        (usr.user_id, 'Investimentos', 'Entrada', '#3b82f6', 'trending-up'),
        (usr.user_id, 'Outras Receitas', 'Entrada', '#8b5cf6', 'plus-circle')
        ON CONFLICT DO NOTHING;

        -- Saídas
        INSERT INTO public.categorias (user_id, nome, tipo, cor, icone) VALUES
        (usr.user_id, 'Alimentação', 'Saída', '#ef4444', 'utensils'),
        (usr.user_id, 'Moradia', 'Saída', '#f97316', 'home'),
        (usr.user_id, 'Transporte', 'Saída', '#eab308', 'car'),
        (usr.user_id, 'Saúde', 'Saída', '#ec4899', 'heart-pulse'),
        (usr.user_id, 'Educação', 'Saída', '#8b5cf6', 'graduation-cap'),
        (usr.user_id, 'Lazer', 'Saída', '#06b6d4', 'ticket'),
        (usr.user_id, 'Assinaturas', 'Saída', '#6366f1', 'repeat'),
        (usr.user_id, 'Outras Despesas', 'Saída', '#64748b', 'minus-circle')
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;
