-- ==========================================
-- ATUALIZAÇÃO: STATUS DE TRANSAÇÃO E RECORRÊNCIAS
-- ==========================================

-- 1. Adicionar Status nas Transações Existentes
ALTER TABLE public.transacoes 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Realizado' CHECK (status IN ('Realizado', 'Agendado', 'Pendente'));

-- Atualizar todas as antigas para Realizado
UPDATE public.transacoes SET status = 'Realizado' WHERE status IS NULL;

-- 2. Tabela de Recorrências (Contas Fixas)
CREATE TABLE IF NOT EXISTS public.recorrentes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    descricao TEXT NOT NULL,
    valor_estimado NUMERIC(15, 2) NOT NULL,
    categoria TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('Entrada', 'Saída', 'Transferência')),
    dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
    
    conta_id UUID REFERENCES public.contas_bancarias(id),
    responsavel TEXT DEFAULT 'Casal',
    ativo BOOLEAN DEFAULT TRUE,
    
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Recorrentes
ALTER TABLE public.recorrentes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários gerenciam suas recorrentes" ON public.recorrentes;
CREATE POLICY "Usuários gerenciam suas recorrentes" ON public.recorrentes FOR ALL USING (auth.uid() = user_id);

-- 3. Tabela de Orçamentos (Limites de Gastos)
CREATE TABLE IF NOT EXISTS public.orcamentos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    categoria TEXT NOT NULL,
    valor_limite NUMERIC(15, 2) NOT NULL,
    periodo TEXT DEFAULT 'Mensal',
    
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    UNIQUE(user_id, categoria)
);

-- RLS Orçamentos
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários gerenciam seus orçamentos" ON public.orcamentos;
CREATE POLICY "Usuários gerenciam seus orçamentos" ON public.orcamentos FOR ALL USING (auth.uid() = user_id);
