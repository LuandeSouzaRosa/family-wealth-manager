"use client"

import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'
import { WealthCard3D } from '@/components/dashboard/wealth-card-3d'
import { TiltCard } from '@/components/ui/tilt-card'

interface KpiSectionProps {
  saldoAtual: number
  renda: number
  despesas: number
  rendaRealizada?: number
  rendaAgendada?: number
  despesasRealizadas?: number
  despesasAgendadas?: number
  saldoLivre?: number
  saldoComprometido?: number
  responsavel: string
}

export function KpiSection({ 
  saldoAtual, 
  renda, 
  despesas, 
  rendaRealizada,
  rendaAgendada,
  despesasRealizadas,
  despesasAgendadas,
  saldoLivre, 
  saldoComprometido, 
  responsavel 
}: KpiSectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      
      {/* 3D Wealth Card (Replaces Standard Card) */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="h-full min-h-[220px]"
      >
        <WealthCard3D 
            saldoAtual={saldoAtual}
            saldoLivre={saldoLivre}
            saldoComprometido={saldoComprometido}
            responsavel={responsavel}
        />
      </motion.div>

      <TiltCard intensity={10} className="h-full">
        <Card className="h-full border border-border/50 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm shadow-sm relative overflow-hidden group transition-all hover:shadow-primary/10 hover:border-primary/30">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-500 ease-out">
            <ArrowUpRight className="w-24 h-24 text-primary" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold tracking-wider uppercase text-primary/80 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Entradas (Mês)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="text-4xl font-light tracking-tight tabular-nums text-foreground"
              data-testid="dashboard-total-entradas"
            >
              {formatCurrency(renda)}
            </div>
            {rendaAgendada !== undefined && rendaAgendada > 0 ? (
                 <div className="mt-2 text-[11px] flex items-center justify-between font-medium">
                     <span className="text-emerald-500/80">Realizado: {formatCurrency(rendaRealizada || 0)}</span>
                     <span className="text-muted-foreground/80">Agendado: {formatCurrency(rendaAgendada)}</span>
                 </div>
            ) : (
                <p className="text-xs text-muted-foreground mt-2 opacity-70">
                    {responsavel !== 'Todos' ? 'Visão consolidada' : 'Total familiar'}
                </p>
            )}
          </CardContent>
        </Card>
      </TiltCard>

      <TiltCard intensity={10} className="h-full">
        <Card className="h-full border border-border/50 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm shadow-sm relative overflow-hidden group transition-all hover:shadow-destructive/10 hover:border-destructive/30">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-500 ease-out">
            <ArrowDownRight className="w-24 h-24 text-destructive" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold tracking-wider uppercase text-destructive/80 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                Saídas (Mês)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="text-4xl font-light tracking-tight tabular-nums text-foreground"
              data-testid="dashboard-total-saidas"
            >
              {formatCurrency(despesas)}
            </div>
            {despesasAgendadas !== undefined && despesasAgendadas > 0 ? (
                 <div className="mt-2 text-[11px] flex items-center justify-between font-medium">
                     <span className="text-red-500/80">Realizado: {formatCurrency(despesasRealizadas || 0)}</span>
                     <span className="text-muted-foreground/80">Agendado: {formatCurrency(despesasAgendadas)}</span>
                 </div>
            ) : (
                 <p className="text-xs text-muted-foreground mt-2 opacity-70">
                    {responsavel !== 'Todos' ? 'Visão consolidada' : 'Total familiar'}
                </p>
            )}
          </CardContent>
        </Card>
      </TiltCard>

    </div>
  )
}
