"use client"

import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { AddOrcamentoDialog } from '@/components/add-orcamento-dialog'
import { Trash2, AlertCircle, Target, CheckCircle2, BarChart3 } from 'lucide-react'
import { useTransition } from 'react'
import { deleteOrcamento } from '@/actions/finance'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface RawOrcamento {
  id: string
  categoria: string
  limite_mensal: number
  responsavel: string
}

interface OrcamentoStatusView {
  categoria?: string
  limite?: number
  gasto?: number
  percentual_uso?: number
  status?: string
}

interface OrcamentosClientProps {
  orcamentos: RawOrcamento[]
  statusData: OrcamentoStatusView[]
}

const SPRING_TRANSITION = { type: "spring" as const, bounce: 0.4, duration: 0.8 }

const fadeUpVariant = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: SPRING_TRANSITION }
}

export function OrcamentosClientShell({ orcamentos, statusData }: OrcamentosClientProps) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = (id: string) => {
    startTransition(() => {
      deleteOrcamento(id)
    })
  }

  // Preparar dados para o gráfico comparativo
  const chartData = orcamentos.map(orc => {
    const stats = statusData.find(s => s.categoria === orc.categoria)
    return {
      name: orc.categoria,
      Limite: orc.limite_mensal,
      Gasto: stats?.gasto || 0
    }
  })

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      className="max-w-6xl mx-auto space-y-8"
    >
      {/* Header */}
      <motion.div variants={fadeUpVariant} className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
        <div className="absolute -inset-4 bg-primary/5 blur-3xl -z-10 rounded-[3rem]" />
        
        <div>
          <h1 className="text-3xl font-light tracking-tight text-foreground mb-2 flex items-center gap-3">
            <Target className="h-8 w-8 text-primary opacity-80" />
            Metas de <span className="font-semibold text-primary">Gastos</span>
          </h1>
          <p className="text-muted-foreground font-mono text-sm uppercase tracking-wider">
            GERENCIAMENTO DE ORÇAMENTOS (BUDGETS)
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <AddOrcamentoDialog />
        </div>
      </motion.div>

      {/* Comparative Chart Section */}
      {chartData.length > 0 && (
        <motion.div variants={fadeUpVariant}>
          <Card className="border border-border bg-card shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <BarChart3 className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-medium text-foreground">Análise Comparativa: Limite vs Realizado</h3>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis 
                      stroke="#888888" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => `R$${value}`} 
                    />
                    <Tooltip 
                      cursor={{fill: 'rgba(255,255,255,0.05)'}}
                      contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                    />
                    <Bar dataKey="Limite" fill="#3f3f46" radius={[4, 4, 0, 0]} name="Meta (Limite)" />
                    <Bar dataKey="Gasto" radius={[4, 4, 0, 0]} name="Gasto Real">
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.Gasto > entry.Limite ? '#ef4444' : '#10b981'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Orcamentos List */}
      <motion.div 
        variants={{
          visible: { transition: { staggerChildren: 0.1 } }
        }}
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
      >
        {orcamentos.length === 0 ? (
          <motion.div variants={fadeUpVariant} className="col-span-1 md:col-span-2 text-center py-12 text-muted-foreground border border-border rounded-2xl bg-card shadow-sm">
            Nenhum limite de gastos definido. Adicione um orçamento para começar.
          </motion.div>
        ) : (
          orcamentos.map((item) => {
            // Find stats from the View or fallback to manually zeroed values
            const stats = statusData.find(s => s.categoria === item.categoria)
            const gasto = stats?.gasto || 0
            const percentual = Math.min(((gasto / item.limite_mensal) * 100) || 0, 100)
            const overBudget = gasto > item.limite_mensal

            let barColor = "bg-emerald-500"
            if (percentual > 80 && percentual <= 100) barColor = "bg-amber-500"
            if (overBudget || percentual > 100) barColor = "bg-red-500"

            return (
              <motion.div 
                key={item.id}
                variants={fadeUpVariant}
                whileHover={{ scale: 1.02, transition: { type: "spring", stiffness: 400, damping: 25 } }}
              >
                <Card className="overflow-hidden border border-border bg-card shadow-sm transition-all duration-300 relative group h-full">
                  <div className={`absolute top-0 left-0 w-full h-1 ${barColor} shadow-[0_0_15px_rgba(0,0,0,0.5)] opacity-80`} />
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="px-2.5 py-0.5 rounded-full bg-secondary text-xs font-semibold uppercase tracking-wider text-secondary-foreground border border-border mb-2 inline-block">
                          {item.categoria}
                        </span>
                        <div className="text-2xl font-light text-foreground mt-1">
                           {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(gasto)}
                           <span className="text-sm text-muted-foreground font-normal ml-2">
                             / {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.limite_mensal)}
                           </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        disabled={isPending}
                        className="opacity-0 group-hover:opacity-100 p-2 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all flex items-center justify-center -mt-2 -mr-2"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-medium">
                        <span className={overBudget ? 'text-red-400' : 'text-muted-foreground'}>
                          {percentual.toFixed(1)}% utilizado
                        </span>
                        <span className="text-muted-foreground flex items-center gap-1">
                          {overBudget 
                            ? <><AlertCircle size={12} className="text-red-400"/> Estourado</>
                            : <><CheckCircle2 size={12} className="text-emerald-400"/> Saudável</>
                          }
                        </span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden shadow-inner border border-border">
                        <motion.div 
                          className={`h-full ${barColor} relative`}
                          initial={{ width: 0 }}
                          animate={{ width: `${percentual}%` }}
                          transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                        >
                          <div className="absolute inset-0 bg-white/20" />
                        </motion.div>
                      </div>
                    </div>

                  </CardContent>
                </Card>
              </motion.div>
            )
          })
        )}
      </motion.div>
    </motion.div>
  )
}
