import { getRecorrentes, toggleRecorrente, deleteRecorrente, processarRecorrencias } from "@/actions/recurrences";
import { RecorrentesClientShell } from "./recorrentes-client"

export const metadata = {
  title: "Custos Fixos | L&L Wealth",
  description: "Gerenciamento de despesas e receitas recorrentes",
}

export default async function RecorrentesPage() {
  const recorrentes = await getRecorrentes()
  
  return (
    <div className="min-h-[80vh] py-8">
      <RecorrentesClientShell recorrentes={recorrentes} />
    </div>
  )
}
