"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon, Plus, TrendingUp } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { createInvestimento } from "@/actions/finance"

import { InvestimentoSchema } from "@/lib/schemas"

// Tipos de Investimentos Comuns na XP
const TIPOS_INVESTIMENTO = [
  "Renda Fixa (CDB/LCI/LCA)", 
  "Tesouro Direto", 
  "Ações", 
  "FIIs", 
  "Fundos de Investimento", 
  "Previdência Privada", 
  "COE", 
  "Criptomoedas", 
  "Saldo em Conta (XP)"
]

export function AddInvestimentoDialog() {
  const [open, setOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()

  const form = useForm<z.infer<typeof InvestimentoSchema>>({
    resolver: zodResolver(InvestimentoSchema) as any,
    defaultValues: {
      nome: "",
      tipo: "Renda Fixa (CDB/LCI/LCA)",
      instituicao: "XP",
      valor_aplicado: 0,
      valor_atual: 0,
      quantidade: 1,
      data_aplicacao: new Date(),
      data_vencimento: undefined,
      liquidez: "No Vencimento",
      responsavel: "Casal",
    },
  })

  function onSubmit(values: z.infer<typeof InvestimentoSchema>) {
    startTransition(async () => {
      const formData = new FormData()
      formData.append("nome", values.nome)
      formData.append("tipo", values.tipo)
      formData.append("instituicao", values.instituicao || "XP")
      formData.append("valor_aplicado", String(values.valor_aplicado))
      formData.append("valor_atual", String(values.valor_atual))
      formData.append("quantidade", String(values.quantidade))
      if (values.data_aplicacao) {
          formData.append("data_aplicacao", values.data_aplicacao.toISOString())
      }
      if (values.data_vencimento) {
        formData.append("data_vencimento", values.data_vencimento.toISOString())
      }
      formData.append("liquidez", values.liquidez || "")
      formData.append("responsavel", values.responsavel)

      const result = await createInvestimento(formData)

      if (result.error) {
        form.setError("root", { message: result.error })
      } else {
        setOpen(false)
        form.reset()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 rounded-full shadow-lg hover:shadow-primary/25 transition-all">
          <Plus size={18} /> Novo Aporte
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
             <TrendingUp className="text-primary h-5 w-5" /> Novo Investimento
          </DialogTitle>
          <DialogDescription>
            Cadastre um novo ativo financeiro (Renda Fixa, Variável, etc).
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Ativo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TIPOS_INVESTIMENTO.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="instituicao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Corretora/Banco</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: XP" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>

            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Ativo / Ticker</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: CDB Master 120% CDI ou PETR4" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="valor_aplicado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Aplicado (R$)</FormLabel>
                      <FormControl>
                        <Input 
                            type="number" step="0.01" placeholder="0.00" {...field} 
                            onChange={(e) => {
                                field.onChange(e);
                                // Sugere o mesmo valor para 'valor_atual' se estiver vazio
                                if (!form.getValues("valor_atual")) {
                                    form.setValue("valor_atual", Number(e.target.value));
                                }
                            }}
                        />
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
                      <FormLabel>Valor Atual (Bruto)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                 <FormField
                  control={form.control}
                  name="data_aplicacao"
                  render={({ field }) => (
                    <FormItem className="flex flex-col pt-2.5">
                      <FormLabel>Data Aplicação</FormLabel>
                      <Popover>
                        <FormControl>
                          <PopoverTrigger
                            className={cn(
                              "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "dd/MM/yyyy", { locale: ptBR })
                            ) : (
                              <span>Selecione</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </PopoverTrigger>
                        </FormControl>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date > new Date()}
                            initialFocus
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="responsavel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsável</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="Casal">Casal</SelectItem>
                            <SelectItem value="Luan">Luan</SelectItem>
                            <SelectItem value="Luana">Luana</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
            
             <FormField
                  control={form.control}
                  name="data_vencimento"
                  render={({ field }) => (
                    <FormItem className="flex flex-col pt-2.5">
                      <FormLabel>Vencimento (Opcional)</FormLabel>
                      <Popover>
                        <FormControl>
                          <PopoverTrigger
                            className={cn(
                              "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "dd/MM/yyyy", { locale: ptBR })
                            ) : (
                              <span>Sem vencimento</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </PopoverTrigger>
                        </FormControl>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value || undefined}
                            onSelect={field.onChange}
                            initialFocus
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : "Registrar Investimento"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
