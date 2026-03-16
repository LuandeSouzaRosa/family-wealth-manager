'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowUpRight, ArrowDownRight, TrendingUp, Wallet, ArrowRightLeft, Target, PieChart, Activity, Eye, EyeOff, Plus, ListFilter } from 'lucide-react'
import { AddTransactionDialog } from '@/components/add-transaction-dialog'
import { ExpensePieChart } from '@/components/charts/expense-pie-chart'
import { NeedsWantsSavingsChart } from '@/components/charts/needs-wants-savings-chart'
import { FinancialEvolutionChart } from '@/components/charts/financial-evolution-chart'
import { motion, type Variants } from 'framer-motion'
import { useFilter } from '@/contexts/filter-context'
import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { KpiSection } from '@/components/dashboard/kpi-section'
import { RecentTransactions } from '@/components/dashboard/recent-transactions'
import { MobileDashboard } from '@/components/dashboard/mobile-dashboard'
import { FinancialHealthWidget } from '@/components/dashboard/financial-health'
import { ResponsavelSelector } from '@/components/responsavel-selector'
import { CalendarRange } from 'lucide-react'

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
    saldoTotal?: number
    saldoComprometido?: number
    saldoLivre?: number
    contas?: any[] // Adicionado para receber as contas
  }
  recentTx: any[]
  orcamentoStatus: any[]
  breakdown503020: any[]
  financialEvolution: any[]
  financialHealth: any
  cashFlowForecast: any[]
}

import { AiAdvisorWidget } from '@/components/dashboard/ai-advisor-widget'

export function DashboardClientShell({ 
// ...
// (manter o restante do código)
  return (
    <motion.div 
      // ...
    >
      {/* ... */}
      
      <AiAdvisorWidget />
    </motion.div>
  )
}
  const { responsavel } = useFilter()

  const shouldShow = (itemResponsavel: string) => {
    if (responsavel === "Todos") return true
    return itemResponsavel?.toLowerCase() === responsavel.toLowerCase()
  }

  const filteredRecentTx = recentTx.filter(tx => shouldShow(tx.responsavel))

  // Calcular o Saldo Atual Baseado no Filtro e nas Contas Reais
  let saldoAtual = 0;
  
  if (metrics.contas && metrics.contas.length > 0) {
      if (responsavel === "Todos") {
          saldoAtual = metrics.contas.reduce((acc, c) => acc + Number(c.saldo_atual), 0);
      } else {
          saldoAtual = metrics.contas
            .filter(c => shouldShow(c.responsavel))
            .reduce((acc, c) => acc + Number(c.saldo_atual), 0);
      }
  } else {
      // Fallback
      saldoAtual = metrics.saldoTotal !== undefined 
        ? metrics.saldoTotal 
        : (metrics.renda - metrics.despesas - metrics.investido)
  }

  // O saldo livre precisa ser recalculado se o usuário filtrar (Saldo Atual Filtrado - Metas)
  // Por enquanto, as metas são globais. Num futuro ideal, cada meta teria um responsável também.
  const saldoLivreAtualizado = metrics.saldoComprometido !== undefined 
        ? saldoAtual - metrics.saldoComprometido 
        : undefined;

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
      <MobileDashboard 
        userEmail={userEmail}
        saldoAtual={saldoAtual}
        renda={metrics.renda}
        despesas={metrics.despesas}
        recentTx={filteredRecentTx}
        responsavel={responsavel}
        financialEvolution={financialEvolution}
        financialHealth={financialHealth}
        cashFlowForecast={cashFlowForecast}
      />

      {/* ===================================================================================== */}
      {/* DESKTOP DASHBOARD (Hidden on mobile)                                                  */}
      {/* ===================================================================================== */}
      <div className="hidden md:block">
      
      {/* Premium Hero Section */}
      <motion.section variants={fadeUpVariant} className="px-6 py-12 md:py-20 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8">
          <div className="space-y-2 relative">
            <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20 flex items-center gap-1.5">
                    <CalendarRange className="w-3 h-3" />
                    {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, (c) => c.toUpperCase())}
                </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground/90">
              Gestão de Patrimônio
            </h1>
            <p className="text-muted-foreground text-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.5)]"></span>
              Visão geral consolidada
            </p>
          </div>
          
          <motion.div 
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto mt-4 md:mt-0 bg-card/50 p-2 rounded-2xl border border-border/50 backdrop-blur-sm"
          >
            <div className="flex-1 sm:flex-none">
                <ResponsavelSelector />
            </div>
            <div className="h-px sm:h-10 w-full sm:w-px bg-border/50" />
            <motion.div 
                whileHover={{ scale: 1.02 }} 
                whileTap={{ scale: 0.98 }}
                className="flex-1 sm:flex-none"
            >
                <AddTransactionDialog />
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* Main Content Area */}
      <div className="px-6 pb-24 max-w-7xl mx-auto space-y-8">
        
        {/* KPIs - Swiss Minimalist Cards with Hover Effects */}
        <motion.div variants={fadeUpVariant}>
            <KpiSection 
                saldoAtual={saldoAtual}
                renda={metrics.renda}
                despesas={metrics.despesas}
                saldoLivre={saldoLivreAtualizado}
                saldoComprometido={metrics.saldoComprometido}
                responsavel={responsavel}
            />
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

        {/* Financial Health & Forecast (NEW - Advanced) */}
        <motion.div variants={scaleUpVariant}>
            <FinancialHealthWidget metrics={financialHealth} forecast={cashFlowForecast} />
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
          <RecentTransactions transactions={filteredRecentTx} responsavel={responsavel} />

        </motion.div>
      </div>
      </div>
    </motion.div>
  )
}
