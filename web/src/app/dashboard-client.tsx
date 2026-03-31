'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Plus, ArrowUpRight, ArrowDownRight, Wallet, Activity, Target, PieChart, Info, ShieldCheck, Download, CalendarRange, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddTransactionDialog } from '@/components/add-transaction-dialog'
import { ExpensePieChart } from '@/components/charts/expense-pie-chart'
import { NeedsWantsSavingsChart } from '@/components/charts/needs-wants-savings-chart'
import { FinancialEvolutionChart } from '@/components/charts/financial-evolution-chart'
import { motion, type Variants } from 'framer-motion'
import { useFilter } from '@/contexts/filter-context'
import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { isResponsibleMatch } from '@/lib/filter-utils'
import { KpiSection } from '@/components/dashboard/kpi-section'
import { RecentTransactions } from '@/components/dashboard/recent-transactions'
import { MobileDashboard } from '@/components/dashboard/mobile-dashboard'
import { FinancialHealthWidget } from '@/components/dashboard/financial-health'
import { ResponsavelSelector } from '@/components/responsavel-selector'
import { SpendingClarityCard } from '@/components/dashboard/spending-clarity-card'

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

import { AiAdvisorWidget } from '@/components/dashboard/ai-advisor-widget'
import { QuickAddWidget } from '@/components/dashboard/quick-add-widget'

interface DashboardClientProps {
  userEmail: string
  metrics: {
    renda: number
    despesas: number
    investido: number
    rendaRealizada?: number
    rendaAgendada?: number
    despesasRealizadas?: number
    despesasAgendadas?: number
    saldoTotal?: number
    saldoComprometido?: number
    saldoLivre?: number
    contas?: any[] 
    porResponsavel?: Record<string, { rendaRealizada: number, rendaAgendada: number, despesasRealizadas: number, despesasAgendadas: number, renda: number, despesas: number }>
    spendingClarity?: Record<string, {
      totalSaidasRealizadas: number
      topCategorias: Array<{ categoria: string; total: number; percentual: number; lancamentos: number }>
      concentracaoTop3Percentual: number
      totalRecorrente: number
      totalPontual: number
      percentualRecorrente: number
      percentualPontual: number
      maiorAltaVsMesAnterior: { categoria: string; delta: number } | null
    }>
  }
  recentTx: any[]
  orcamentoStatus: Record<string, any[]>
  breakdown503020: Record<string, any[]>
  financialEvolution: any[]
  financialHealth: any
  cashFlowForecast: any[]
}

export function DashboardClientShell({ 
  userEmail,
  metrics,
  recentTx,
  orcamentoStatus,
  breakdown503020,
  financialEvolution,
  financialHealth,
  cashFlowForecast
}: DashboardClientProps) {
  const { responsavel } = useFilter()

  const shouldShow = (itemResponsavel: string) => isResponsibleMatch(itemResponsavel, responsavel)

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

  // Renda e Despesa Isoladas
  let rendaAtual = metrics.rendaRealizada !== undefined ? metrics.rendaRealizada + metrics.rendaAgendada! : metrics.renda;
  let despesasAtual = metrics.despesasRealizadas !== undefined ? metrics.despesasRealizadas + metrics.despesasAgendadas! : metrics.despesas;
  let rendaRealizada = metrics.rendaRealizada || metrics.renda;
  let rendaAgendada = metrics.rendaAgendada || 0;
  let despesasRealizadas = metrics.despesasRealizadas || metrics.despesas;
  let despesasAgendadas = metrics.despesasAgendadas || 0;

  if (responsavel !== "Todos" && metrics.porResponsavel && metrics.porResponsavel[responsavel]) {
      const respMetrics = metrics.porResponsavel[responsavel];
      rendaAtual = respMetrics.renda;
      despesasAtual = respMetrics.despesas;
      rendaRealizada = respMetrics.rendaRealizada;
      rendaAgendada = respMetrics.rendaAgendada;
      despesasRealizadas = respMetrics.despesasRealizadas;
      despesasAgendadas = respMetrics.despesasAgendadas;
  }

  const emptySpendingClarity = {
    totalSaidasRealizadas: 0,
    topCategorias: [],
    concentracaoTop3Percentual: 0,
    totalRecorrente: 0,
    totalPontual: 0,
    percentualRecorrente: 0,
    percentualPontual: 0,
    maiorAltaVsMesAnterior: null,
  };
  const activeSpendingClarity =
    metrics.spendingClarity?.[responsavel] ||
    metrics.spendingClarity?.Todos ||
    emptySpendingClarity;

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
        renda={rendaAtual}
        despesas={despesasAtual}
        rendaRealizada={rendaRealizada}
        rendaAgendada={rendaAgendada}
        despesasRealizadas={despesasRealizadas}
        despesasAgendadas={despesasAgendadas}
        recentTx={filteredRecentTx}
        responsavel={responsavel}
        financialEvolution={financialEvolution}
        financialHealth={financialHealth}
        cashFlowForecast={cashFlowForecast}
        spendingClarity={activeSpendingClarity}
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
            <div className="flex flex-col sm:flex-row gap-2 flex-1 sm:flex-none">
              <Link href="/conciliacao" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto gap-2 bg-primary text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] transition-all h-12 px-6 rounded-xl font-semibold tracking-wide" data-testid="btn-importar-csv">
                  <Upload className="w-4 h-4" /> Importar Extrato
                </Button>
              </Link>
              <div className="w-full sm:w-auto">
                  <AddTransactionDialog variant="secondary" />
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Main Content Area */}
      <div className="px-6 pb-24 max-w-7xl mx-auto space-y-8">
        
        {/* KPIs - Swiss Minimalist Cards with Hover Effects */}
        <motion.div variants={fadeUpVariant}>
            <KpiSection 
                saldoAtual={saldoAtual}
                renda={rendaAtual}
                despesas={despesasAtual}
                rendaRealizada={rendaRealizada}
                rendaAgendada={rendaAgendada}
                despesasRealizadas={despesasRealizadas}
                despesasAgendadas={despesasAgendadas}
                saldoLivre={saldoLivreAtualizado}
                saldoComprometido={metrics.saldoComprometido}
                responsavel={responsavel}
            />
        </motion.div>

        <motion.div variants={fadeUpVariant}>
          <SpendingClarityCard data={activeSpendingClarity} responsavel={responsavel} />
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
                <NeedsWantsSavingsChart data={breakdown503020[responsavel] || []} />
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
               <ExpensePieChart data={orcamentoStatus[responsavel] || []} />
            </CardContent>
          </Card>

          {/* Elegant Ledger */}
          <RecentTransactions transactions={filteredRecentTx} responsavel={responsavel} />

        </motion.div>
      </div>
      </div>
      {/* AI Advisor Widget Floating */}
      <AiAdvisorWidget responsavel={responsavel} />
      
      {/* Quick Add Widget (Mobile Only) */}
      <QuickAddWidget />
    </motion.div>
  )
}
