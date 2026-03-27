import { getTransactions, deleteTransaction } from "@/actions/transactions"
import { getContasBancarias, getCartoesCredito } from "@/actions/accounts"
import { TransacoesClientShell } from "./transacoes-client"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

import { cookies } from "next/headers"

export const dynamic = "force-dynamic"

export default async function TransacoesPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Next.js 15+ has async searchParams and cookies
  const resolvedParams = await searchParams;
  const cookieStore = await cookies();
  
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  let monthParam = currentMonth;
  let yearParam = currentYear;

  let urlHasValidMonth = false;
  let urlHasValidYear = false;

  // 1. Try URL parameters (highest priority)
  if (resolvedParams?.month) {
    const parsed = parseInt(resolvedParams.month as string);
    // 0 is "Todos"
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 12) {
       monthParam = parsed;
       urlHasValidMonth = true;
    }
  }

  if (resolvedParams?.year) {
    const parsed = parseInt(resolvedParams.year as string);
    // 0 is "Todos"
    if (!isNaN(parsed) && (parsed === 0 || (parsed >= 2000 && parsed <= 2100))) {
       yearParam = parsed;
       urlHasValidYear = true;
    }
  }

  // 2. Try Cookie Fallback if URL is missing
  if (!urlHasValidMonth || !urlHasValidYear) {
    const savedPeriod = cookieStore.get('fwm_transacoes_period')?.value;

    if (savedPeriod && savedPeriod.includes('-')) {
      const [cMonthStr, cYearStr] = savedPeriod.split('-');
      const cMonth = parseInt(cMonthStr, 10);
      const cYear = parseInt(cYearStr, 10);

      const isValidCookieMonth = !isNaN(cMonth) && cMonth >= 0 && cMonth <= 12;
      const isValidCookieYear = !isNaN(cYear) && (cYear === 0 || (cYear >= 2000 && cYear <= 2100));

      if (isValidCookieMonth && isValidCookieYear) {
        if (!urlHasValidMonth) monthParam = cMonth;
        if (!urlHasValidYear) yearParam = cYear;
      }
    }
  }

  // Lote fatiado! Overfetch evitado na fonte.
  const transactions = await getTransactions(monthParam, yearParam)
  const cartoes = await getCartoesCredito()

  return (
    <div className="min-h-screen bg-transparent p-6 md:p-12 relative overflow-hidden">
      {/* Premium Gradient Backdrops */}
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-primary/5 rounded-full blur-[120px] -z-10" />
      <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-emerald-500/5 rounded-full blur-[100px] -z-10" />
      
      <TransacoesClientShell 
         initialData={transactions || []} 
         initialCartoes={cartoes || []} 
         initialMonth={monthParam.toString()} 
         initialYear={yearParam.toString()} 
      />
    </div>
  )
}
