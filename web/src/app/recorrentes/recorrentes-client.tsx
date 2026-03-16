"use client"

import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { AddRecorrenteDialog } from '@/components/add-recorrente-dialog'
import { Trash2, Power, PowerOff, Wallet, RefreshCw, Play } from 'lucide-react'
import { useTransition } from 'react'
import { toggleRecorrente, deleteRecorrente, processarRecorrencias } from '@/actions/finance'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Recorrente {
  id: string
  descricao: string
  valor: number
  categoria: string
  tipo: string
  dia_vencimento: number
  ativo: boolean
  frequencia?: string
}

interface RecorrentesClientProps {
  recorrentes: Recorrente[]
}

const SPRING_TRANSITION = { type: "spring" as const, bounce: 0.4, duration: 0.8 }

const fadeUpVariant = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: SPRING_TRANSITION }
}

export function RecorrentesClientShell({ recorrentes }: RecorrentesClientProps) {
  const [isPending, startTransition] = useTransition()

  const handleToggle = (id: string, currentStatus: boolean) => {
    startTransition(() => {
      toggleRecorrente(id, currentStatus)
    })
  }

  const handleDelete = (id: string) => {
    startTransition(() => {
      deleteRecorrente(id)
    })
  }

  const handleProcessar = () => {
    if(!confirm("Deseja gerar as transações previstas deste mês para as recorrências ativas?")) return;
    
    startTransition(async () => {
      const res = await processarRecorrencias()
      if (res.success) {
        alert(res.message)
      } else {
        alert("Erro: " + res.message)
      }
    })
  }

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      className="max-w-4xl mx-auto space-y-8 p-6"
    >
      {/* Header */}
      <motion.div variants={fadeUpVariant} className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
        <div className="absolute -inset-4 bg-primary/5 blur-3xl -z-10 rounded-[3rem]" />
        
        <div>
          <h1 className="text-3xl font-light tracking-tight text-foreground mb-2 flex items-center gap-3">
            <RefreshCw className="h-8 w-8 text-primary opacity-80" />
            Custos <span className="font-semibold text-primary">Fixos</span>
          </h1>
          <p className="text-muted-foreground font-mono text-sm uppercase tracking-wider">
            GERENCIAMENTO DE RECORRÊNCIAS MENSAIS
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={handleProcessar}
            disabled={isPending}
            className="border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary hover:text-primary"
          >
            <Play className="mr-2 h-4 w-4" /> Gerar Previsões
          </Button>
          <AddRecorrenteDialog />
        </div>
      </motion.div>

      {/* Recorrentes List */}
      <motion.div 
        variants={{
          visible: { transition: { staggerChildren: 0.1 } }
        }}
        className="grid gap-4"
      >
        {recorrentes.length === 0 ? (
          <motion.div variants={fadeUpVariant} className="text-center py-12 text-muted-foreground border border-dashed border-muted-foreground/20 rounded-2xl bg-card/50">
            Nenhuma despesa ou receita recorrente cadastrada.
          </motion.div>
        ) : (
          recorrentes.map((item) => (
            <motion.div 
              key={item.id}
              variants={fadeUpVariant}
              whileHover={{ scale: 1.01, transition: { type: "spring", stiffness: 400, damping: 25 } }}
            >
              <Card className={cn(
                "overflow-hidden border bg-card shadow-sm hover:shadow-md transition-all duration-300",
                !item.ativo && "opacity-60 grayscale bg-muted/50"
              )}>
                <div className={`absolute top-0 left-0 w-1 h-full ${item.tipo === 'Entrada' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    
                    {/* Left: Day & Info */}
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-muted/50 border border-border shadow-sm">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Dia</span>
                        <span className="text-xl font-semibold text-foreground">{item.dia_vencimento}</span>
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-medium text-foreground">{item.descricao}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2.5 py-0.5 rounded-full bg-muted text-xs font-medium text-muted-foreground border border-border">
                            {item.categoria}
                          </span>
                          <span className={cn(
                            "text-xs uppercase tracking-wider font-semibold",
                            item.tipo === 'Entrada' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                          )}>
                            {item.tipo}
                          </span>
                          {item.frequencia && (
                             <span className="text-xs text-muted-foreground border-l border-border pl-2 ml-1">
                                {item.frequencia}
                             </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Value & Actions */}
                    <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t border-border md:border-t-0">
                      <div className="text-right">
                        <span className={cn(
                          "text-xl font-light tracking-tight",
                          item.tipo === 'Entrada' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
                        )}>
                          {item.tipo === 'Entrada' ? '+' : '-'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleToggle(item.id, item.ativo)}
                          disabled={isPending}
                          data-testid={`btn-toggle-${item.id}`}
                          className={cn(
                            "p-2 rounded-full transition-colors flex items-center justify-center",
                            item.ativo 
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20' 
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          )}
                          title={item.ativo ? "Desativar" : "Ativar"}
                        >
                          {item.ativo ? <Power size={18} /> : <PowerOff size={18} />}
                        </button>
                        
                        <button 
                          onClick={() => handleDelete(item.id)}
                          disabled={isPending}
                          data-testid={`btn-delete-${item.id}`}
                          className="p-2 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors flex items-center justify-center"
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </motion.div>
    </motion.div>
  )
}
