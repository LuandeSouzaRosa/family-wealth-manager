import { getInvestimentos } from "@/actions/finance"
import { InvestimentosClientShell } from "./investimentos-client"

export const metadata = {
  title: "Investimentos | L&L Wealth",
  description: "Gestão de Portfólio e Ativos (XP, Renda Fixa, Variável)",
}

export default async function InvestimentosPage() {
  const investimentos = await getInvestimentos()
  
  return (
    <div className="min-h-[80vh] py-8">
      <InvestimentosClientShell initialInvestimentos={investimentos} />
    </div>
  )
}
