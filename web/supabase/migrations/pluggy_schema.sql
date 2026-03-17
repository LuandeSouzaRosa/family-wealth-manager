-- ==========================================
-- PLUGGY OPEN BANKING INTEGRATION SCHEMA
-- ==========================================

-- 1. Conexões Pluggy (vincula item_id da Pluggy ao user_id do Supabase)
CREATE TABLE IF NOT EXISTS public.pluggy_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pluggy_item_id TEXT NOT NULL UNIQUE,
    pluggy_account_id TEXT,
    connector_name TEXT,
    conta_bancaria_id UUID REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active',
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pluggy_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pluggy_connections_user_policy" ON public.pluggy_connections
    FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_pluggy_connections_item ON public.pluggy_connections(pluggy_item_id);
CREATE INDEX idx_pluggy_connections_user ON public.pluggy_connections(user_id);

-- 2. Logs de Webhook (auditoria)
CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    event_type TEXT,
    payload JSONB,
    status TEXT DEFAULT 'received',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Coluna para dedup de transações Pluggy
ALTER TABLE public.transacoes ADD COLUMN IF NOT EXISTS pluggy_transaction_id TEXT UNIQUE;
