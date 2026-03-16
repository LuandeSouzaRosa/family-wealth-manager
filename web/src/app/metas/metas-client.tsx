"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createMeta, deleteMeta, updateMeta } from "@/actions/finance"
import { Button } from "@/components/ui/button"
import { Plus, Target, Trash2, Edit2, TrendingUp, PiggyBank, Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form-new"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/lib/utils"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { differenceInMonths } from "date-fns"
import { MetaSchema } from "@/lib/schemas"

export function MetasClient({ initialMetas }: { initialMetas: any[] }) {
  const [metas, setMetas] = useState(initialMetas)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [editingMeta, setEditingMeta] = useState<any>(null)

  const form = useForm<z.infer<typeof MetaSchema>>({
    resolver: zodResolver(MetaSchema) as any,
    defaultValues: {
      nome: "",
      valor_alvo: 0,
      valor_atual: 0,
      data_limite: null,
      cor: "#10b981",
    },
  })

  const totalAlvo = metas.reduce((acc, m) => acc + Number(m.valor_alvo), 0)
  const totalAtual = metas.reduce((acc, m) => acc + Number(m.valor_atual), 0)
  const progressoGeral = totalAlvo > 0 ? (totalAtual / totalAlvo) * 100 : 0

  const handleOpenCreate = () => {
    setEditingMeta(null)
    form.reset({
      nome: "",
      valor_alvo: 0,
      valor_atual: 0,
      data_limite: null,
      cor: "#10b981",
    })
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (meta: any) => {
    setEditingMeta(meta)
    form.reset({
      nome: meta.nome,
      valor_alvo: Number(meta.valor_alvo),
      valor_atual: Number(meta.valor_atual),
      data_limite: meta.data_limite ? new Date(meta.data_limite) : null,
      cor: meta.cor || "#10b981",
    })
    setIsDialogOpen(true)
  }

  const handleSubmit = (values: z.infer<typeof MetaSchema>) => {
    startTransition(async () => {
      const formData = new FormData()
      formData.append("nome", values.nome)
      formData.append("valor_alvo", String(values.valor_alvo))
      formData.append("valor_atual", String(values.valor_atual || 0))
      if (values.data_limite) {
          formData.append("data_limite", values.data_limite.toISOString())
      }
      formData.append("cor", values.cor)
      
      let result
      if (editingMeta) {
        result = await updateMeta(editingMeta.id, formData)
      } else {
        result = await createMeta(formData)
      }

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(editingMeta ? "Meta atualizada!" : "Meta criada com sucesso!")
        setIsDialogOpen(false)
        // Recarregar página para atualizar dados
        window.location.reload()
      }
    })
  }

  const calculateMonthlyContribution = (meta: any) => {
    if (!meta.data_limite || meta.valor_atual >= meta.valor_alvo) return null
    
    const today = new Date()
    const targetDate = new Date(meta.data_limite)
    const monthsLeft = differenceInMonths(targetDate, today)
    
    if (monthsLeft <= 0) return "Vencida"
    
    const remaining = meta.valor_alvo - meta.valor_atual
    return remaining / monthsLeft
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta meta?")) return
    startTransition(async () => {
      const result = await deleteMeta(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Meta excluída.")
        setMetas(metas.filter(m => m.id !== id))
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* Resumo Geral */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-primary/10 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary">Total Acumulado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(totalAtual)}</div>
            <p className="text-xs text-muted-foreground">Em todas as metas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Objetivo Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalAlvo)}</div>
            <p className="text-xs text-muted-foreground">Soma dos alvos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Progresso Geral</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{progressoGeral.toFixed(1)}%</div>
            <Progress value={progressoGeral} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Botão Nova Meta */}
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Nova Meta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingMeta ? "Editar Meta" : "Nova Meta Financeira"}</DialogTitle>
              <DialogDescription>
                Defina quanto você quer juntar e para quê.
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Meta</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Reserva de Emergência" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="valor_alvo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor Alvo (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="10000.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="valor_atual"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Já Tenho (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="data_limite"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Alvo (Opcional)</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          value={field.value ? field.value.toISOString().split('T')[0] : ''} 
                          onChange={e => field.onChange(e.target.value ? new Date(e.target.value) : null)} 
                        />
                      </FormControl>
                      <p className="text-[10px] text-muted-foreground">
                        Define o prazo para calcular a economia mensal necessária.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Salvando..." : "Salvar Meta"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de Metas */}
      {metas.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
          <PiggyBank className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Nenhuma meta criada</h3>
          <p className="text-muted-foreground">Comece criando um pote para seus sonhos.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {metas.map((meta) => {
            const progresso = meta.valor_alvo > 0 ? (meta.valor_atual / meta.valor_alvo) * 100 : 0
            const aporteMensal = calculateMonthlyContribution(meta)
            
            return (
              <motion.div
                key={meta.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="overflow-hidden border-t-4 border-t-primary shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
                  <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                    <div>
                      <CardTitle className="text-lg">{meta.nome}</CardTitle>
                      <CardDescription>
                        Falta {formatCurrency(meta.valor_alvo - meta.valor_atual)}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleOpenEdit(meta)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(meta.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-2 flex-1">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-semibold text-primary">{formatCurrency(meta.valor_atual)}</span>
                      <span className="text-muted-foreground">{formatCurrency(meta.valor_alvo)}</span>
                    </div>
                    <Progress value={progresso} className="h-3" />
                    
                    {meta.data_limite && (
                        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
                            <span className="text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> {new Date(meta.data_limite).toLocaleDateString('pt-BR')}
                            </span>
                            {aporteMensal && typeof aporteMensal === 'number' && (
                                <span className="font-medium text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                    Poupar {formatCurrency(aporteMensal)}/mês
                                </span>
                            )}
                            {aporteMensal === 'Vencida' && (
                                <span className="font-medium text-red-600 bg-red-500/10 px-2 py-0.5 rounded-full">
                                    Prazo Vencido
                                </span>
                            )}
                        </div>
                    )}
                  </CardContent>
                  <CardFooter className="pt-2 pb-4">
                    <div className="text-xs text-muted-foreground w-full text-center">
                      {progresso.toFixed(1)}% concluído
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