"use client"

import { useState, useTransition } from "react"
import { motion } from "framer-motion"
import { CreditCard, Calendar, TrendingUp, AlertCircle, Trash2, DollarSign } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { AddCardDialog } from "@/components/add-card-dialog"
import { deleteCartaoCredito } from "@/actions/finance"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"

interface CartoesClientProps {
  initialCartoes: any[]
}

export function CartoesClient({ initialCartoes }: CartoesClientProps) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja remover este cartão? O histórico de transações será mantido, mas desvinculado.")) {
      startTransition(async () => {
        const result = await deleteCartaoCredito(id)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success("Cartão removido com sucesso.")
        }
      })
    }
  }

  const getLimitColor = (percent: number) => {
    if (percent > 90) return "bg-red-500"
    if (percent > 70) return "bg-yellow-500"
    return "bg-emerald-500"
  }

  return (
    <div className="space-y-8 p-6 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cartões de Crédito</h1>
          <p className="text-muted-foreground">
            Gerencie seus limites e acompanhe as faturas em tempo real.
          </p>
        </div>
        <AddCardDialog />
      </div>

      {/* Grid de Cartões */}
      {initialCartoes.length === 0 ? (
        <Card className="border-dashed border-2 bg-muted/10">
          <CardContent className="flex flex-col items-center justify-center h-64 text-center">
            <div className="p-4 bg-muted rounded-full mb-4">
              <CreditCard className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Nenhum cartão cadastrado</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Adicione seus cartões para controlar o limite e saber exatamente quanto virá na próxima fatura.
            </p>
            <AddCardDialog />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {initialCartoes.map((cartao, index) => {
            const fatura = cartao.fatura_atual || { valor: 0, status: "Aberta" }
            const percentualUso = cartao.limite > 0 ? (fatura.valor / cartao.limite) * 100 : 0
            const disponivel = cartao.limite - fatura.valor

            return (
              <motion.div
                key={cartao.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Card className="overflow-hidden border-t-4 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col" style={{ borderTopColor: cartao.cor }}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center shadow-inner">
                           {/* Simulação de Logo do Banco baseada na cor */}
                           <div className="w-6 h-6 rounded-full opacity-80" style={{ backgroundColor: cartao.cor }}></div>
                        </div>
                        <div>
                          <CardTitle className="text-lg">{cartao.nome}</CardTitle>
                          <CardDescription className="text-xs uppercase tracking-wider font-semibold">
                            {cartao.responsavel}
                          </CardDescription>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(cartao.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-6 flex-1">
                    {/* Fatura Atual */}
                    <div className="space-y-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Fatura Atual (Vence dia {cartao.dia_vencimento})
                        </span>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-bold text-foreground">
                                {formatCurrency(fatura.valor)}
                            </span>
                            <span className="text-xs text-emerald-500 font-medium mb-1 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                Aberta
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Fecha dia {cartao.dia_fechamento}
                        </p>
                    </div>

                    {/* Limite Progress */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-medium">
                            <span className="text-muted-foreground">Limite Usado</span>
                            <span className={percentualUso > 90 ? "text-red-500" : "text-foreground"}>
                                {percentualUso.toFixed(1)}%
                            </span>
                        </div>
                        <Progress value={percentualUso} className="h-2" indicatorClassName={getLimitColor(percentualUso)} />
                        <div className="flex justify-between text-xs text-muted-foreground pt-1">
                            <span>Disponível: <strong className="text-emerald-600">{formatCurrency(disponivel)}</strong></span>
                            <span>Total: {formatCurrency(cartao.limite)}</span>
                        </div>
                    </div>
                  </CardContent>

                  <CardFooter className="bg-muted/30 pt-4 pb-4 border-t border-border/50">
                      <div className="w-full flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1 text-muted-foreground">
                              <AlertCircle className="w-3 h-3" /> Melhor dia de compra: 
                              <strong className="text-foreground">{cartao.dia_fechamento}</strong>
                          </div>
                          {/* Future: Button to see details */}
                      </div>
                  </CardFooter>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
