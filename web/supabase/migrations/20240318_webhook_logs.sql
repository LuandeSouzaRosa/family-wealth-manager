-- Tabela para Logs de Webhooks (Auditoria e Debug)
CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    provider text NOT NULL, -- 'pluggy', 'stripe', etc.
    event_type text,
    payload jsonb,
    status text,
    created_at timestamptz DEFAULT now()
);

-- RLS: Apenas admins/service_role podem ver logs (ou ninguém se for estrito)
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
-- Por padrão, sem policies, ninguém acessa via Client (seguro)
