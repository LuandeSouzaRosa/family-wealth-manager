-- ==========================================
-- MIGRATION: COUPLE VIEW & 50/30/20 RULE
-- Data: 2026-03-13
-- ==========================================

-- 1. ESTRUTURA DE FAMÍLIAS (COUPLE VIEW)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.families (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
    role TEXT DEFAULT 'member', -- 'admin', 'member'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS em Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles visiveis para autenticados" ON public.profiles
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios podem editar proprio perfil" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Função para criar perfil automaticamente no cadastro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_family_id UUID;
BEGIN
    -- Tenta encontrar uma família padrão ou cria uma para o primeiro usuário
    SELECT id INTO default_family_id FROM public.families LIMIT 1;
    
    IF default_family_id IS NULL THEN
        INSERT INTO public.families (name) VALUES ('Minha Família') RETURNING id INTO default_family_id;
    END IF;

    INSERT INTO public.profiles (id, family_id)
    VALUES (new.id, default_family_id);
    
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger (apenas cria se não existir)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill para usuários existentes (Luan e Luana)
DO $$
DECLARE
    fam_id UUID;
    u record;
BEGIN
    -- Garante que existe uma família
    SELECT id INTO fam_id FROM public.families LIMIT 1;
    IF fam_id IS NULL THEN
        INSERT INTO public.families (name) VALUES ('Família L&L') RETURNING id INTO fam_id;
    END IF;

    -- Cria perfil para usuários que não têm
    FOR u IN SELECT id FROM auth.users LOOP
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = u.id) THEN
            INSERT INTO public.profiles (id, family_id) VALUES (u.id, fam_id);
        END IF;
    END LOOP;
END $$;


-- 2. ATUALIZAÇÃO DE RLS PARA COMPARTILHAMENTO
-- ==========================================
-- A lógica agora é: "Posso ver se o registro é meu OU se o dono do registro é da minha família"

CREATE OR REPLACE FUNCTION public.get_my_family_id()
RETURNS UUID AS $$
    SELECT family_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Função auxiliar para checar permissão de família
CREATE OR REPLACE FUNCTION public.is_same_family(record_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        record_user_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM public.profiles p1
            JOIN public.profiles p2 ON p1.family_id = p2.family_id
            WHERE p1.id = auth.uid() AND p2.id = record_user_id
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizando Policies (Drop e Re-create para garantir)

-- Transações
DROP POLICY IF EXISTS "Transacoes_SELECT" ON public.transacoes;
CREATE POLICY "Transacoes_SELECT_Family" ON public.transacoes FOR SELECT USING (public.is_same_family(user_id));

DROP POLICY IF EXISTS "Transacoes_INSERT" ON public.transacoes;
CREATE POLICY "Transacoes_INSERT_Family" ON public.transacoes FOR INSERT WITH CHECK (auth.uid() = user_id); -- Só insere pro próprio nome

DROP POLICY IF EXISTS "Transacoes_UPDATE" ON public.transacoes;
CREATE POLICY "Transacoes_UPDATE_Family" ON public.transacoes FOR UPDATE USING (public.is_same_family(user_id));

DROP POLICY IF EXISTS "Transacoes_DELETE" ON public.transacoes;
CREATE POLICY "Transacoes_DELETE_Family" ON public.transacoes FOR DELETE USING (public.is_same_family(user_id));

-- Recorrentes
DROP POLICY IF EXISTS "Recorrentes_SELECT" ON public.recorrentes;
CREATE POLICY "Recorrentes_SELECT_Family" ON public.recorrentes FOR SELECT USING (public.is_same_family(user_id));
-- (Manter as outras policies similares para UPDATE/DELETE se desejar edição colaborativa)

-- Orçamentos
DROP POLICY IF EXISTS "Orcamentos_SELECT" ON public.orcamentos;
CREATE POLICY "Orcamentos_SELECT_Family" ON public.orcamentos FOR SELECT USING (public.is_same_family(user_id));

-- Patrimônio
DROP POLICY IF EXISTS "Patrimonio_SELECT" ON public.patrimonio;
CREATE POLICY "Patrimonio_SELECT_Family" ON public.patrimonio FOR SELECT USING (public.is_same_family(user_id));


-- 3. VIEW PARA A REGRA 50/30/20
-- ==========================================
-- Categoriza gastos automaticamente baseado na categoria

CREATE OR REPLACE VIEW public.vw_503020_analysis AS
WITH categorized_transactions AS (
    SELECT 
        user_id,
        valor,
        CASE 
            WHEN categoria IN ('Moradia', 'Alimentação', 'Saúde', 'Transporte', 'Educação') THEN 'Necessidades (50%)'
            WHEN categoria IN ('Lazer', 'Assinaturas', 'Outros') THEN 'Desejos (30%)'
            WHEN categoria IN ('Investimento') THEN 'Investimentos (20%)'
            ELSE 'Desejos (30%)' -- Default fallback
        END as bucket
    FROM public.transacoes
    WHERE tipo = 'Saída' OR (tipo = 'Transferência' AND categoria = 'Investimento') -- Considera transferências p/ investimento
      AND to_char(data, 'YYYY-MM') = to_char(now(), 'YYYY-MM') -- Mês atual
)
SELECT 
    user_id,
    bucket,
    SUM(valor) as total
FROM categorized_transactions
GROUP BY user_id, bucket;

-- Habilitar security invoker para a view respeitar o RLS de família
ALTER VIEW public.vw_503020_analysis SET (security_invoker = on);
