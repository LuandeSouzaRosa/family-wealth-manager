import { Suspense } from "react"
import { getContasBancarias } from "@/actions/finance"
import { ContasClient } from "./contas-client"
import { WalletCards } from "lucide-react"

export default async function ContasPage() {
  const contas = await getContasBancarias()

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <WalletCards className="h-8 w-8 text-primary" />
            Contas Bancárias
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as contas da família e seus saldos atuais.
          </p>
        </div>
      </div>

      <Suspense fallback={<div className="text-center py-10">Carregando contas...</div>}>
        <ContasClient initialContas={contas} />
      </Suspense>
    </div>
  )
}