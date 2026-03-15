-- ==========================================
-- MÓDULO DE CONTAS BANCÁRIAS (MULTI-TENANT CASAL)
-- ==========================================

-- 1. Criar a tabela de contas bancárias
CREATE TABLE IF NOT EXISTS public.contas_bancarias (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL, -- Ex: "Nubank Principal"
    instituicao TEXT, -- Ex: "Nubank", "Banco do Brasil"
    saldo_atual NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    responsavel TEXT NOT NULL DEFAULT 'Todos', -- "Luan", "Luana", "Todos"
    cor TEXT DEFAULT '#10b981', -- Cor para os gráficos
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger para updated_at da tabela de contas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_contas_bancarias_updated_at') THEN
        CREATE TRIGGER update_contas_bancarias_updated_at
            BEFORE UPDATE ON public.contas_bancarias
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- RLS para contas_bancarias
ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem ver suas próprias contas" ON public.contas_bancarias;
CREATE POLICY "Usuários podem ver suas próprias contas" ON public.contas_bancarias FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem gerenciar suas próprias contas" ON public.contas_bancarias;
CREATE POLICY "Usuários podem gerenciar suas próprias contas" ON public.contas_bancarias FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- 2. Atualizar a tabela de transações
-- ==========================================

-- Adicionar coluna conta_id na tabela de transacoes
ALTER TABLE public.transacoes 
ADD COLUMN IF NOT EXISTS conta_id UUID REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;

-- Adicionar coluna conta_destino_id (para transferências entre contas)
ALTER TABLE public.transacoes 
ADD COLUMN IF NOT EXISTS conta_destino_id UUID REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;

-- Permitir o tipo "Transferência" na coluna tipo (que hoje é Entrada/Saída/Transferência)
-- (Como a coluna 'tipo' é TEXT e não um ENUM no Postgres, não precisamos dar ALTER TYPE, o frontend cuida disso).

-- ==========================================
-- 3. Criar uma "Conta Legado" para os dados existentes
-- ==========================================
-- Para não quebrar o dashboard atual, vamos criar uma conta padrão e vincular todas as transações antigas a ela.
DO $$
DECLARE
    v_user_id UUID;
    v_conta_id UUID;
BEGIN
    -- Pegar o primeiro usuário (assumindo que o Luan é o dono do banco)
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
        -- Verifica se já existe uma conta legado
        SELECT id INTO v_conta_id FROM public.contas_bancarias WHERE nome = 'Conta Principal (Legado)' LIMIT 1;
        
        -- Se não existir, cria
        IF v_conta_id IS NULL THEN
            INSERT INTO public.contas_bancarias (nome, instituicao, saldo_atual, responsavel, user_id)
            VALUES ('Conta Principal (Legado)', 'Sistema', 0, 'Todos', v_user_id)
            RETURNING id INTO v_conta_id;
        END IF;

        -- Atualiza todas as transações antigas que não têm conta
        UPDATE public.transacoes SET conta_id = v_conta_id WHERE conta_id IS NULL;
    END IF;
END $$;
