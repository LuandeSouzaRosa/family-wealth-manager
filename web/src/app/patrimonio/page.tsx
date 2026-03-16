import { getPatrimonio, deletePatrimonio } from "@/actions/assets"
import { PatrimonioClientShell } from "./patrimonio-client"

export const metadata = {
  title: "Patrimônio | L&L Wealth",
  description: "Controle de Ativos e Passivos (Net Worth)",
}

export default async function PatrimonioPage() {
  const patrimonio = await getPatrimonio()
  
  return (
    <div className="min-h-[80vh] py-8">
      <PatrimonioClientShell patrimonio={patrimonio} />
    </div>
  )
}
