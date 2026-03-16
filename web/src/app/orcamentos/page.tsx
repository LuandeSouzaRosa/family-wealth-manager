import { getOrcamentos, deleteOrcamento, getOrcamentoStatus, get503020Metrics } from "@/actions/budgets";
import { OrcamentosClientShell } from "./orcamentos-client"

export const metadata = {
  title: "Orçamentos | L&L Wealth",
  description: "Gerenciamento de metas de gastos (Budgets)",
}

export default async function OrcamentosPage() {
  const [orcamentos, statusData] = await Promise.all([
    getOrcamentos(),
    getOrcamentoStatus()
  ])
  
  return (
    <div className="min-h-[80vh] py-8">
      <OrcamentosClientShell orcamentos={orcamentos} statusData={statusData} />
    </div>
  )
}
