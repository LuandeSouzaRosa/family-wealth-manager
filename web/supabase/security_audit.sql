-- ==========================================
-- SECURITY: AUDIT LOGS (Anti-Hacker Traceability)
-- Data: 2026-03-13
-- ==========================================

-- 1. Tabela de Logs de Auditoria
-- Registra quem fez o que, quando e o que mudou.
-- Essencial para detectar atividades suspeitas ou erros operacionais.

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    record_id UUID,
    user_id UUID, -- Quem fez a alteração
    old_data JSONB,
    new_data JSONB,
    changed_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS (Somente leitura para admins, ou ninguém se for log interno)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Política: Ninguém pode alterar logs (Imutabilidade)
-- Apenas sistema insere via Trigger.
-- Leitura: Apenas admins (futuro) ou o próprio usuário de suas ações
CREATE POLICY "Users view own logs" ON public.audit_logs
    FOR SELECT USING (auth.uid() = user_id);

-- 2. Trigger Genérico de Auditoria
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    payload_old JSONB;
    payload_new JSONB;
    current_user_id UUID;
BEGIN
    -- Tenta pegar o ID do usuário da sessão Supabase
    current_user_id := auth.uid();
    
    IF (TG_OP = 'DELETE') THEN
        payload_old := to_jsonb(OLD);
        INSERT INTO public.audit_logs (table_name, operation, record_id, user_id, old_data)
        VALUES (TG_TABLE_NAME, TG_OP, OLD.id, current_user_id, payload_old);
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        payload_old := to_jsonb(OLD);
        payload_new := to_jsonb(NEW);
        INSERT INTO public.audit_logs (table_name, operation, record_id, user_id, old_data, new_data)
        VALUES (TG_TABLE_NAME, TG_OP, NEW.id, current_user_id, payload_old, payload_new);
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        payload_new := to_jsonb(NEW);
        INSERT INTO public.audit_logs (table_name, operation, record_id, user_id, new_data)
        VALUES (TG_TABLE_NAME, TG_OP, NEW.id, current_user_id, payload_new);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Aplicar Trigger nas Tabelas Críticas

-- Transações
DROP TRIGGER IF EXISTS audit_transacoes ON public.transacoes;
CREATE TRIGGER audit_transacoes
    AFTER INSERT OR UPDATE OR DELETE ON public.transacoes
    FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- Patrimônio
DROP TRIGGER IF EXISTS audit_patrimonio ON public.patrimonio;
CREATE TRIGGER audit_patrimonio
    AFTER INSERT OR UPDATE OR DELETE ON public.patrimonio
    FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- Orçamentos
DROP TRIGGER IF EXISTS audit_orcamentos ON public.orcamentos;
CREATE TRIGGER audit_orcamentos
    AFTER INSERT OR UPDATE OR DELETE ON public.orcamentos
    FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- Recorrentes
DROP TRIGGER IF EXISTS audit_recorrentes ON public.recorrentes;
CREATE TRIGGER audit_recorrentes
    AFTER INSERT OR UPDATE OR DELETE ON public.recorrentes
    FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();
