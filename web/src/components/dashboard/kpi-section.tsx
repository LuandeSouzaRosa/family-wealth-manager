"use client"

import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'
import { WealthCard3D } from '@/components/dashboard/wealth-card-3d'

interface KpiSectionProps {
  saldoAtual: number
  renda: number
  despesas: number
  saldoLivre?: number
  saldoComprometido?: number
  responsavel: string
}

export function KpiSection({ 
  saldoAtual, 
  renda, 
  despesas, 
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

      <motion.div whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 400 }}>
        <Card className="h-full border border-border shadow-sm bg-card relative overflow-hidden group transition-all hover:shadow-primary/5 hover:border-primary/20">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-500 ease-out">
            <ArrowUpRight className="w-24 h-24 text-primary" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="text-sm font-semibold tracking-wider uppercase text-primary">
                Entradas (Mês) {responsavel !== 'Todos' && '(Consolidado)'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-light tracking-tight tabular-nums text-foreground/90">
              {formatCurrency(renda)}
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
            <CardDescription className="text-sm font-semibold tracking-wider uppercase text-destructive">
                Saídas (Mês) {responsavel !== 'Todos' && '(Consolidado)'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-light tracking-tight tabular-nums text-foreground/90">
              {formatCurrency(despesas)}
            </div>
          </CardContent>
        </Card>
      </motion.div>

    </div>
  )
}