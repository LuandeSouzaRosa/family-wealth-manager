import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// Esta rota será chamada pelo Vercel Cron (ou GitHub Actions) diariamente
export async function GET(request: NextRequest) {
  // 1. Segurança: Verificar CRON_SECRET para evitar chamadas indevidas
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // Inicializar Supabase Admin (Service Role) para acessar dados de TODOS os usuários
  // Precisamos da SERVICE_ROLE_KEY pois o Cron não tem sessão de usuário logado.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const hoje = new Date()
  const diaAtual = hoje.getDate()
  const mesAtual = hoje.getMonth()
  const anoAtual = hoje.getFullYear()

  // 2. Buscar recorrências ativas que vencem hoje
  const { data: recorrentes, error } = await supabase
    .from('recorrentes')
    .select('*')
    .eq('ativo', true)
    .eq('dia_vencimento', diaAtual)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!recorrentes || recorrentes.length === 0) {
    return NextResponse.json({ message: 'Nenhuma conta vence hoje.' })
  }

  let processados = 0
  let ignorados = 0

  // 3. Processar cada conta
  for (const item of recorrentes) {
    // Definir o intervalo do mês atual para verificar duplicidade
    const inicioMes = new Date(anoAtual, mesAtual, 1).toISOString()
    const fimMes = new Date(anoAtual, mesAtual + 1, 0).toISOString()

    // Verificar se já foi lançada neste mês
    // Critério: Mesmo UserID, Mesma Descrição, Mesmo Valor, Data dentro do mês
    const { data: existentes } = await supabase
      .from('transacoes')
      .select('id')
      .eq('user_id', item.user_id)
      .eq('descricao', item.descricao)
      .eq('valor', item.valor)
      .gte('data', inicioMes)
      .lte('data', fimMes)

    if (existentes && existentes.length > 0) {
      ignorados++
      continue // Já existe, pular
    }

    // Criar a transação
    const { error: insertError } = await supabase
      .from('transacoes')
      .insert([
        {
          user_id: item.user_id,
          descricao: item.descricao,
          valor: item.valor,
          categoria: item.categoria,
          tipo: item.tipo,
          responsavel: item.responsavel,
          origem: 'Automático (Recorrência)', // Marca como automático
          data: new Date().toISOString(), // Data de hoje
          tag: 'fixo' // Tag útil para filtros
        }
      ])

    if (!insertError) {
      processados++
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      dia: diaAtual,
      total_encontrados: recorrentes.length,
      novos_lancamentos: processados,
      ja_existiam: ignorados
    }
  })
}
