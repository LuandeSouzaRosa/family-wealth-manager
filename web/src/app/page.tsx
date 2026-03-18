import { createClient } from '@/utils/supabase/server'
import { 
  getDashboardMetrics, 
  getFinancialEvolution,
  getFinancialHealthMetrics,
  getCashFlowForecast 
} from '@/actions/dashboard'
import { getRecentTransactions } from '@/actions/transactions'
import { getOrcamentoStatus, get503020Metrics } from '@/actions/budgets'
import { redirect } from 'next/navigation'
import { DashboardClientShell } from '@/app/dashboard-client'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Buscar dados reais das Views do Supabase
  const [
    metrics, 
    recentTx, 
    orcamentoStatus, 
    breakdown503020, 
    financialEvolution,
    financialHealth,
    cashFlowForecast
  ] = await Promise.all([
    getDashboardMetrics(),
    getRecentTransactions(10),
    getOrcamentoStatus(),
    get503020Metrics(),
    getFinancialEvolution(),
    getFinancialHealthMetrics(),
    getCashFlowForecast()
  ])

  return (
    <DashboardClientShell 
      userEmail={user.email || 'Usuário'} 
      metrics={metrics || { renda: 0, despesas: 0, investido: 0, saldoTotal: 0 }} 
      recentTx={recentTx} 
      orcamentoStatus={orcamentoStatus || { Todos: [], Luan: [], Luana: [], Casal: [] }}
      breakdown503020={breakdown503020 || { Todos: [], Luan: [], Luana: [], Casal: [] }}
      financialEvolution={financialEvolution || []}
      financialHealth={financialHealth}
      cashFlowForecast={cashFlowForecast || []}
    />
  )
}
