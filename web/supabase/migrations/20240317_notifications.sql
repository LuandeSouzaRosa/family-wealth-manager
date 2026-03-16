-- Tabela de Notificações do Sistema
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    message text NOT NULL,
    type text CHECK (type IN ('info', 'warning', 'success', 'error')) DEFAULT 'info',
    read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Permissões
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" 
ON public.notifications FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications (mark as read)" 
ON public.notifications FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

-- Índices
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications (user_id, read);
