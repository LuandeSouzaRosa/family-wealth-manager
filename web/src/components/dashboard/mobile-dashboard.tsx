"use client"

import { useState, useEffect } from "react"
import { Eye, EyeOff, Plus, ListFilter, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { AddTransactionDialog } from "@/components/add-transaction-dialog"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils"
import { FinancialEvolutionChart } from "@/components/charts/financial-evolution-chart"
import { FinancialHealthWidget } from "@/components/dashboard/financial-health"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface MobileDashboardProps {
  userEmail: string
  saldoAtual: number
  renda: number
  despesas: number
  recentTx: any[]
  responsavel: string
  financialEvolution: any[]
  financialHealth: any
  cashFlowForecast: any[]
}

export function MobileDashboard({ 
  userEmail, 
  saldoAtual, 
  renda, 
  despesas, 
  recentTx,
  responsavel,
  financialEvolution,
  financialHealth,
  cashFlowForecast
}: MobileDashboardProps) {
  const [hideValues, setHideValues] = useState(false)
  const [greeting, setGreeting] = useState("Olá")

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting("Bom dia")
    else if (hour < 18) setGreeting("Boa tarde")
    else setGreeting("Boa noite")
  }, [])

  return (
    <div className="md:hidden flex flex-col gap-6 px-5 pt-8">
        
      {/* 1. Header & Saldo */}
      <div className="space-y-1">
          <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">{greeting}, {userEmail.split('@')[0]}</p>
              <button onClick={() => setHideValues(!hideValues)} className="p-2 -mr-2 text-muted-foreground hover:text-foreground">
                  {hideValues ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
          </div>
          <div className="flex items-baseline gap-2">
              <h1 className="text-3xl font-bold tracking-tight">
                  {hideValues ? "R$ •••••" : formatCurrency(saldoAtual)}
              </h1>
          </div>
          <p className="text-xs text-muted-foreground">
              {responsavel === 'Todos' ? 'Capital Disponível Total' : `Capital (Visão Consolidada)`}
          </p>
      </div>

      {/* 2. Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
          <div className="col-span-1">
              <AddTransactionDialog>
                  <div className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 rounded-xl flex items-center justify-center gap-2 font-medium cursor-pointer shadow-lg shadow-primary/20">
                      <Plus className="w-5 h-5" /> Novo Gasto
                  </div>
              </AddTransactionDialog>
          </div>
          <Link href="/transacoes" className="col-span-1">
              <div className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 h-12 rounded-xl flex items-center justify-center gap-2 font-medium cursor-pointer">
                  <ListFilter className="w-5 h-5" /> Extrato
              </div>
          </Link>
      </div>

      {/* 3. Resumo Mensal (Mini Cards) */}
      <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border/50 p-4 rounded-xl flex flex-col gap-1 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-500 text-xs font-medium uppercase tracking-wider">
                  <ArrowUpRight className="w-3 h-3" /> Entrou
              </div>
              <span className="text-lg font-semibold text-foreground">
                  {hideValues ? "•••••" : formatCurrency(renda)}
              </span>
          </div>
          <div className="bg-card border border-border/50 p-4 rounded-xl flex flex-col gap-1 shadow-sm">
              <div className="flex items-center gap-2 text-red-500 text-xs font-medium uppercase tracking-wider">
                  <ArrowDownRight className="w-3 h-3" /> Saiu
              </div>
              <span className="text-lg font-semibold text-foreground">
                  {hideValues ? "•••••" : formatCurrency(despesas)}
              </span>
          </div>
      </div>

      {/* 3.5 Evolução e Saúde (Mobile) */}
      <div className="space-y-3">
          <h3 className="text-base font-semibold">Saúde Financeira</h3>
          <FinancialHealthWidget metrics={financialHealth} forecast={cashFlowForecast} />
          
          <h3 className="text-base font-semibold pt-4">Histórico Patrimonial</h3>
          <Card className="border border-border/50 shadow-sm bg-card">
             <CardContent className="h-[200px] p-0 pt-4 pr-2">
                <FinancialEvolutionChart data={financialEvolution} />
             </CardContent>
          </Card>
      </div>

      {/* 4. Últimas Transações (Lista Limpa) */}
      <div className="space-y-3">
          <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Últimas Movimentações {responsavel !== 'Todos' && <span className="text-xs font-normal text-muted-foreground">({responsavel})</span>}</h3>
              <Link href="/transacoes" className="text-xs text-primary font-medium">Ver todas</Link>
          </div>
          
          {recentTx.length === 0 ? (
              <div className="text-center py-8 bg-muted/20 rounded-xl border border-dashed border-muted-foreground/20">
                  <p className="text-sm text-muted-foreground">Nenhuma movimentação recente encontrada para este filtro.</p>
              </div>
          ) : (
              <div className="flex flex-col gap-3">
                  {recentTx.slice(0, 5).map((tx) => {
                       const isIncome = tx.tipo === 'Entrada';
                       return (
                          <div key={tx.id} className="flex items-center justify-between bg-card p-3 rounded-xl border border-border/40 shadow-sm">
                              <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isIncome ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                      {isIncome ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                                  </div>
                                  <div className="flex flex-col">
                                      <span className="text-sm font-medium text-foreground line-clamp-1">{tx.descricao}</span>
                                      <span className="text-xs text-muted-foreground">{tx.categoria} • {new Date(tx.data).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}</span>
                                  </div>
                              </div>
                              <span className={`text-sm font-semibold ${isIncome ? 'text-emerald-600' : 'text-foreground'}`}>
                                  {isIncome ? '+' : '-'}{hideValues ? "•••••" : formatCurrency(tx.valor)}
                              </span>
                          </div>
                       )
                  })}
              </div>
          )}
      </div>
    </div>
  )
}