"use client"

import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AddOrcamentoDialog } from '@/components/add-orcamento-dialog'
import { PiggyBank, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react'
import { useTransition } from 'react'
import { deleteOrcamento } from "@/actions/budgets";
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useFilter } from '@/contexts/filter-context'

interface Orcamento {
  id: string
  categoria: string
  valor_limite: number
  responsavel: string
}

interface OrcamentoStatus {
  categoria: string
  gasto_atual: number
  limite: number
  percentual: number
}

interface OrcamentosClientProps {
  orcamentos: Orcamento[]
  statusData: OrcamentoStatus[]
}

const SPRING_TRANSITION = { type: "spring" as const, bounce: 0.4, duration: 0.8 }

const fadeUpVariant = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: SPRING_TRANSITION }
}

export function OrcamentosClientShell({ orcamentos, statusData }: OrcamentosClientProps) {
  const [isPending, startTransition] = useTransition()
  const { responsavel } = useFilter()

  const handleDelete = (id: string) => {
    if(confirm("Deseja remover este orçamento?")) {
        startTransition(() => {
          deleteOrcamento(id)
        })
    }
  }

  // Combinar dados estáticos com dados dinâmicos de gasto
  const data = orcamentos.map(orc => {
      const status = statusData.find(s => s.categoria === orc.categoria)
      return {
          ...orc,
          gasto: status ? status.gasto_atual : 0,
          percentual: status ? (status.gasto_atual / orc.valor_limite) * 100 : 0
      }
  }).filter(item => {
      if (responsavel === "Todos") return true
      return item.responsavel === responsavel || item.responsavel === "Casal"
  })

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      className="max-w-5xl mx-auto space-y-8 p-6"
    >
      {/* Header */}
      <motion.div variants={fadeUpVariant} className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-foreground mb-2 flex items-center gap-3">
            <PiggyBank className="h-8 w-8 text-primary opacity-80" />
            Metas de <span className="font-semibold text-primary">Gastos</span>
          </h1>
          <p className="text-muted-foreground font-mono text-sm uppercase tracking-wider">
            CONTROLE DE ORÇAMENTO MENSAL
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AddOrcamentoDialog />
        </div>
      </motion.div>

      {/* Grid de Orçamentos */}
      <motion.div 
        variants={{
            visible: { transition: { staggerChildren: 0.1 } }
        }}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        {data.length === 0 ? (
           <div className="col-span-full text-center py-16 border border-dashed border-muted-foreground/20 rounded-2xl bg-card/50 flex flex-col items-center justify-center opacity-80">
             <PiggyBank className="h-12 w-12 text-muted-foreground/30 mb-4" />
             <p className="text-base font-medium text-foreground">Nenhum orçamento definido</p>
             <p className="text-sm text-muted-foreground mt-1">Crie um limite de gastos para acompanhar suas metas financeiras.</p>
           </div>
        ) : (
           data.map(item => {
               const isOverLimit = item.gasto > item.valor_limite
               const isWarning = item.percentual > 80 && !isOverLimit
               
               return (
                   <motion.div key={item.id} variants={fadeUpVariant}>
                       <Card className={cn(
                           "border shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden",
                           isOverLimit ? "border-red-500/50 bg-red-500/5" : "bg-card"
                       )}>
                           <CardContent className="p-6 space-y-4">
                               <div className="flex justify-between items-start">
                                   <div>
                                       <h3 className="font-semibold text-lg">{item.categoria}</h3>
                                       <p className="text-xs text-muted-foreground">Responsável: {item.responsavel}</p>
                                   </div>
                                   <div className="text-right">
                                       <div className="text-sm text-muted-foreground">Limite</div>
                                       <div className="font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor_limite)}</div>
                                   </div>
                               </div>

                               <div className="space-y-2">
                                   <div className="flex justify-between text-sm">
                                       <span className={cn(
                                           "font-medium",
                                           isOverLimit ? "text-red-600" : isWarning ? "text-yellow-600" : "text-primary"
                                       )}>
                                           Gasto: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.gasto)}
                                       </span>
                                       <span className="text-muted-foreground">{item.percentual.toFixed(0)}%</span>
                                   </div>
                                   <Progress 
                                        value={Math.min(item.percentual, 100)} 
                                        className={cn(
                                            "h-2",
                                            isOverLimit ? "bg-red-100 dark:bg-red-950" : ""
                                        )}
                                        // Custom color logic would need custom component or CSS, but shadcn progress uses 'primary'
                                        // We can override via style or className on the Indicator if exposed, 
                                        // but standard Progress is fine for now.
                                   />
                               </div>

                               <div className="flex justify-between items-center pt-2">
                                   <div className="flex items-center gap-2 text-xs">
                                       {isOverLimit ? (
                                           <span className="text-red-600 flex items-center gap-1 font-medium">
                                               <AlertTriangle size={14} /> Estourado em {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.gasto - item.valor_limite)}
                                           </span>
                                       ) : (
                                           <span className="text-emerald-600 flex items-center gap-1 font-medium">
                                               <CheckCircle size={14} /> Dentro da meta
                                           </span>
                                       )}
                                   </div>
                                   <button 
                                        onClick={() => handleDelete(item.id)}
                                        className="text-xs text-muted-foreground hover:text-destructive underline"
                                        disabled={isPending}
                                   >
                                       Remover
                                   </button>
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
