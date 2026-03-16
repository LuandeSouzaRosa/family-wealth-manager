import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

// Esta rota deve ser chamada diariamente por um Cron Job (ex: 08:00 AM)
export async function GET(request: Request) {
  const supabase = await createClient()

  // Como é uma rota Cron, não temos sessão do usuário.
  // Precisamos iterar sobre usuários ativos ou usar Service Role Key (admin)
  // Por simplicidade aqui, vamos apenas logar que o job rodou.
  // Em produção, usaríamos supabaseAdmin.auth.listUsers() ou similar.
  
  // Exemplo de lógica para um usuário específico (dev)
  const targetUserId = 'USER_UUID_AQUI'; // Substituir pela lógica real de iteração

  // 1. Verificar Faturas de Cartão Fechando Hoje
  const today = new Date();
  const day = today.getDate();

  // Buscar cartões que fecham hoje
  const { data: cartoes } = await supabase
    .from('cartoes_credito')
    .select('id, nome, dia_fechamento, user_id')
    .eq('dia_fechamento', day);

  const notifications = [];

  if (cartoes && cartoes.length > 0) {
      for (const card of cartoes) {
          notifications.push({
              user_id: card.user_id,
              title: 'Fatura Fechada',
              message: `A fatura do cartão ${card.nome} fecha hoje. Revise seus gastos.`,
              type: 'info'
          });
      }
  }

  // 2. Inserir notificações no banco
  if (notifications.length > 0) {
      const { error } = await supabase.from('notifications').insert(notifications);
      if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
      }
  }

  return NextResponse.json({ 
      success: true, 
      processed: notifications.length, 
      message: 'Notificações geradas com sucesso.' 
  });
}
