-- ==========================================
-- MIGRATION: ADICIONAR EMAIL EM PROFILES
-- Data: 2026-03-13
-- Objetivo: Facilitar a exibição de membros da família na UI
-- ==========================================

-- 1. Adicionar coluna email na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Atualizar função handle_new_user para salvar email
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

    INSERT INTO public.profiles (id, family_id, email)
    VALUES (new.id, default_family_id, new.email);
    
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Backfill: Copiar emails da tabela auth.users para profiles existentes
-- (Necessário pois profiles antigos estão sem email)
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;
