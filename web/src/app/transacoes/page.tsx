import { getTransactions, getCartoesCredito } from "@/actions/finance"
import { TransacoesClientShell } from "./transacoes-client"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function TransacoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch all transactions and cards
  const transactions = await getTransactions()
  const cartoes = await getCartoesCredito()

  return (
    <div className="min-h-screen bg-transparent p-6 md:p-12 relative overflow-hidden">
      {/* Premium Gradient Backdrops */}
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-primary/5 rounded-full blur-[120px] -z-10" />
      <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-emerald-500/5 rounded-full blur-[100px] -z-10" />
      
      <TransacoesClientShell initialData={transactions || []} initialCartoes={cartoes || []} />
    </div>
  )
}
