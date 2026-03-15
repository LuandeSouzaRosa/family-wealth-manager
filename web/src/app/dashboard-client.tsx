'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowUpRight, ArrowDownRight, TrendingUp, Wallet, ArrowRightLeft, Target, PieChart, Activity, Eye, EyeOff, Plus, ListFilter } from 'lucide-react'
import { AddTransactionDialog } from '@/components/add-transaction-dialog'
import { ExpensePieChart } from '@/components/charts/expense-pie-chart'
import { NeedsWantsSavingsChart } from '@/components/charts/needs-wants-savings-chart'
import { FinancialEvolutionChart } from '@/components/charts/financial-evolution-chart'
import { motion, type Variants } from 'framer-motion'
import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'

// Constants for orchestration
const STAGGER_DELAY = 0.1
const SPRING_TRANSITION = { type: "spring" as const, bounce: 0.4, duration: 0.8 }

const fadeUpVariant: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: SPRING_TRANSITION }
}

const scaleUpVariant: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: SPRING_TRANSITION }
}

interface DashboardClientProps {
  userEmail: string
  metrics: {
    renda: number
    despesas: number
    investido: number
    saldoTotal?: number // Novo campo
  }
  recentTx: any[]
  orcamentoStatus: any[]
  breakdown503020: any[]
  financialEvolution: any[]
}

export function DashboardClientShell({ 
  userEmail, 
  metrics, 
  recentTx,
  orcamentoStatus,
  breakdown503020,
  financialEvolution
}: DashboardClientProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  // Se metrics.saldoTotal vier do backend (cálculo global), usamos ele.
  // Caso contrário, fallback para cálculo mensal (que estava errado).
  const saldoAtual = metrics.saldoTotal !== undefined 
    ? metrics.saldoTotal 
    : (metrics.renda - metrics.despesas - metrics.investido)

  const [hideValues, setHideValues] = useState(false)
  const [greeting, setGreeting] = useState("Olá")

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting("Bom dia")
    else if (hour < 18) setGreeting("Boa tarde")
    else setGreeting("Boa noite")
  }, [])

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: STAGGER_DELAY } }
      }}
      className="min-h-screen bg-transparent text-foreground pb-20 md:pb-0"
      data-testid="dashboard-content"
    >
      
      {/* ===================================================================================== */}
      {/* MOBILE DASHBOARD (Visible only on small screens)                                      */}
      {/* ===================================================================================== */}
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
            <p className="text-xs text-muted-foreground">Capital Disponível Total</p>
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
                    {hideValues ? "•••••" : formatCurrency(metrics.renda)}
                </span>
            </div>
            <div className="bg-card border border-border/50 p-4 rounded-xl flex flex-col gap-1 shadow-sm">
                <div className="flex items-center gap-2 text-red-500 text-xs font-medium uppercase tracking-wider">
                    <ArrowDownRight className="w-3 h-3" /> Saiu
                </div>
                <span className="text-lg font-semibold text-foreground">
                    {hideValues ? "•••••" : formatCurrency(metrics.despesas)}
                </span>
            </div>
        </div>

        {/* 4. Últimas Transações (Lista Limpa) */}
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Últimas Movimentações</h3>
                <Link href="/transacoes" className="text-xs text-primary font-medium">Ver todas</Link>
            </div>
            
            {recentTx.length === 0 ? (
                <div className="text-center py-8 bg-muted/20 rounded-xl border border-dashed border-muted-foreground/20">
                    <p className="text-sm text-muted-foreground">Nenhuma movimentação recente.</p>
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

      {/* ===================================================================================== */}
      {/* DESKTOP DASHBOARD (Hidden on mobile)                                                  */}
      {/* ===================================================================================== */}
      <div className="hidden md:block">
      
      {/* Premium Hero Section */}
      <motion.section variants={fadeUpVariant} className="px-6 py-12 md:py-20 max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8">
          <div className="space-y-2 relative">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground/90">
              Gestão de Patrimônio
            </h1>
            <p className="text-muted-foreground text-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.5)]"></span>
              Visão geral consolidada para {userEmail}
            </p>
          </div>
          <motion.div 
            whileHover={{ scale: 1.05 }} 
            whileTap={{ scale: 0.95 }}
            className="w-full md:w-auto mt-4 md:mt-0"
          >
            <AddTransactionDialog />
          </motion.div>
        </div>
      </motion.section>

      {/* Main Content Area */}
      <div className="px-6 pb-24 max-w-7xl mx-auto space-y-8">
        
        {/* KPIs - Swiss Minimalist Cards with Hover Effects */}
        <motion.div variants={fadeUpVariant} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <motion.div whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 400 }}>
            <Card className="h-full border border-border shadow-sm bg-card relative overflow-hidden group transition-all hover:shadow-primary/5 hover:border-primary/20">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-500 ease-out">
                <Wallet className="w-24 h-24 text-primary" />
              </div>
              <CardHeader className="pb-2">
                <CardDescription className="text-sm font-semibold tracking-wider uppercase text-muted-foreground">Capital Disponível (Total)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl md:text-5xl font-light tracking-tight tabular-nums bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {formatCurrency(saldoAtual)}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 400 }}>
            <Card className="h-full border border-border shadow-sm bg-card relative overflow-hidden group transition-all hover:shadow-primary/5 hover:border-primary/20">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-500 ease-out">
                <ArrowUpRight className="w-24 h-24 text-primary" />
              </div>
              <CardHeader className="pb-2">
                <CardDescription className="text-sm font-semibold tracking-wider uppercase text-primary">Entradas (Mês)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-light tracking-tight tabular-nums text-foreground/90">
                  {formatCurrency(metrics.renda)}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 400 }}>
            <Card className="h-full border border-border shadow-sm bg-card relative overflow-hidden group transition-all hover:shadow-destructive/5 hover:border-destructive/20">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-500 ease-out">
                <ArrowDownRight className="w-24 h-24 text-destructive" />
              </div>
              <CardHeader className="pb-2">
                <CardDescription className="text-sm font-semibold tracking-wider uppercase text-destructive">Saídas (Mês)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-light tracking-tight tabular-nums text-foreground/90">
                  {formatCurrency(metrics.despesas)}
                </div>
              </CardContent>
            </Card>
          </motion.div>

        </motion.div>

        {/* Financial Evolution Chart (NEW) */}
        <motion.div variants={scaleUpVariant}>
           <Card className="border border-border shadow-sm bg-card">
             <CardHeader>
               <CardTitle className="text-lg font-light flex items-center gap-2 text-foreground">
                 <Activity className="text-primary w-5 h-5" /> Evolução Patrimonial
               </CardTitle>
               <CardDescription className="text-muted-foreground">Histórico de acumulação de saldo</CardDescription>
             </CardHeader>
             <CardContent className="h-[300px]">
                <FinancialEvolutionChart data={financialEvolution} />
             </CardContent>
           </Card>
        </motion.div>

        {/* 50/30/20 Analysis Section */}
        <motion.div variants={scaleUpVariant} className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <Card className="md:col-span-3 border border-border shadow-sm bg-card">
             <CardHeader>
               <CardTitle className="text-lg font-light flex items-center gap-2 text-foreground">
                 <Target className="text-primary w-5 h-5" /> Regra 50/30/20
               </CardTitle>
               <CardDescription className="text-muted-foreground">Distribuição ideal: 50% Necessidades, 30% Desejos, 20% Investimentos</CardDescription>
             </CardHeader>
             <CardContent className="h-[350px]">
                <NeedsWantsSavingsChart data={breakdown503020} />
             </CardContent>
           </Card>
        </motion.div>

        {/* Secondary Info Layout: Graph and Ledger */}
        <motion.div variants={scaleUpVariant} className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-8">
          
          {/* Cashflow Chart Placeholder (Fase 13) */}
          <Card className="md:col-span-2 overflow-hidden border border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-light flex items-center gap-2 text-foreground">
                <PieChart className="text-primary w-5 h-5" /> Análise de Fluxo
              </CardTitle>
              <CardDescription className="text-muted-foreground">Distribuição de despesas por categoria de orçamento</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center mx-6 mb-6 rounded-xl border border-border bg-muted/20 p-2 shadow-inner">
               <ExpensePieChart data={orcamentoStatus} />
            </CardContent>
          </Card>

          {/* Elegant Ledger */}
          <Card className="border border-border shadow-sm bg-card">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Histórico Recente</CardTitle>
              <CardDescription>Últimas {recentTx.length} movimentações.</CardDescription>
            </CardHeader>
            <CardContent>
              {recentTx.length === 0 ? (
                <div className="text-center py-12">
                   <p className="text-sm text-muted-foreground">Nenhuma transação registrada.</p>
                </div>
              ) : (
                <motion.div 
                  variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
                  className="space-y-6"
                >
                  {recentTx.map((tx) => {
                    const isIncome = tx.tipo === 'Entrada';
                    const isInvestment = tx.tipo === 'Transferência';
                    return (
                      <motion.div 
                        key={tx.id} 
                        variants={fadeUpVariant}
                        className="flex items-start justify-between group p-2 rounded-lg hover:bg-muted/50 transition-colors -mx-2 cursor-default"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none group-hover:text-primary transition-colors">
                            {tx.descricao}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(tx.data).toLocaleDateString('pt-BR')} • {tx.categoria}
                          </p>
                        </div>
                        <div className={`text-sm font-medium tabular-nums ${isIncome ? 'text-primary' : isInvestment ? 'text-blue-500' : 'text-foreground/80'}`}>
                          {isIncome ? '+' : '-'}{formatCurrency(tx.valor)}
                        </div>
                      </motion.div>
                    )
                  })}
                </motion.div>
              )}
            </CardContent>
          </Card>

        </motion.div>
      </div>
      </div>
    </motion.div>
  )
}
