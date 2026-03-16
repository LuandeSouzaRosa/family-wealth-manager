import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

// ==========================================
// PLUGGY WEBHOOK HANDLER (Estrutura Base)
// ==========================================
// Esta rota receberá notificações da Pluggy quando houver novas transações.
// Documentação: https://docs.pluggy.ai/docs/webhooks

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const payload = await request.json()
    const event = payload.event

    console.log("[Pluggy Webhook] Event received:", event)

    // 1. Logar o evento para auditoria
    await supabase.from("webhook_logs").insert([{
        provider: "pluggy",
        event_type: event,
        payload: payload,
        status: "received"
    }])

    // 2. Processar Eventos de Transação
    if (event === "transaction.created") {
        const { itemId, data: transaction } = payload
        
        // AQUI ENTRARÁ A LÓGICA FUTURA:
        // 1. Buscar qual usuário é dono deste itemId (Account ID)
        // 2. Converter dados da Pluggy para nosso modelo
        // 3. Inserir na tabela 'transacoes' evitando duplicatas
        
        console.log("Nova transação detectada:", transaction.description)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error("[Pluggy Webhook] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
