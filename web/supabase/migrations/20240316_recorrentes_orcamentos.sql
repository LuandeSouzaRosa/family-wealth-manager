-- ==========================================
-- GESTÃO DE RECORRÊNCIAS (Assinaturas e Contas Fixas)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.recorrentes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    descricao TEXT NOT NULL, -- Ex: "Netflix", "Aluguel", "Salário Luan"
    valor NUMERIC(15, 2) NOT NULL,
    categoria TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('Entrada', 'Saída', 'Transferência')),
    
    dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
    
    conta_id UUID REFERENCES public.contas_bancarias(id), -- Opcional: já lança na conta certa
    responsavel TEXT DEFAULT 'Casal', -- "Luan", "Luana", "Casal"
    
    ativo BOOLEAN DEFAULT TRUE,
    ultima_processada DATE, -- Para saber se já gerou a transação deste mês
    
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.recorrentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam suas recorrentes" ON public.recorrentes;
CREATE POLICY "Usuários gerenciam suas recorrentes" ON public.recorrentes FOR ALL USING (auth.uid() = user_id);

-- ORÇAMENTOS (Budgets)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.orcamentos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    categoria TEXT NOT NULL, -- Ex: "Alimentação", "Lazer"
    valor_limite NUMERIC(15, 2) NOT NULL, -- Ex: 2000.00
    periodo TEXT DEFAULT 'Mensal', -- Por enquanto apenas mensal
    
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    UNIQUE(user_id, categoria) -- Um orçamento por categoria por usuário
);

-- RLS
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam seus orçamentos" ON public.orcamentos;
CREATE POLICY "Usuários gerenciam seus orçamentos" ON public.orcamentos FOR ALL USING (auth.uid() = user_id);
