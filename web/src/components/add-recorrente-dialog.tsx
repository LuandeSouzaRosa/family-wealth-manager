"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { CalendarIcon, Plus, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { createRecorrente } from "@/actions/recurrences";
import { CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA, RESPONSAVEIS } from "@/lib/constants"

import { RecorrenteSchema } from "@/lib/schemas"

export function AddRecorrenteDialog() {
  const [open, setOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()

  const form = useForm<z.infer<typeof RecorrenteSchema>>({
    resolver: zodResolver(RecorrenteSchema) as any,
    defaultValues: {
      descricao: "",
      valor: 0,
      categoria: "",
      tipo: "Saída",
      dia_vencimento: 5,
      frequencia: "Mensal",
      responsavel: "Casal",
    },
  })

  // Assistir tipo para categorias
  const tipoSelecionado = form.watch("tipo")
  const categoriasDisponiveis = tipoSelecionado === "Entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA

  function onSubmit(values: z.infer<typeof RecorrenteSchema>) {
    startTransition(async () => {
      const formData = new FormData()
      formData.append("descricao", values.descricao)
      formData.append("valor", String(values.valor))
      formData.append("categoria", values.categoria)
      formData.append("tipo", values.tipo)
      formData.append("dia_vencimento", String(values.dia_vencimento))
      formData.append("frequencia", values.frequencia)
      formData.append("responsavel", values.responsavel)

      const result = await createRecorrente(formData)

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
        <Button className="bg-primary hover:bg-primary/90 gap-2">
          <Plus size={18} /> Nova Recorrência
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
             <RefreshCw className="text-primary h-5 w-5" /> Cadastrar Conta Fixa
          </DialogTitle>
          <DialogDescription>
            Cadastre contas que se repetem (Aluguel, Netflix, Salário) para automação.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Netflix, Aluguel..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="valor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Estimado</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dia_vencimento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dia Vencimento</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" max="31" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                 <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Saída">Despesa (Saída)</SelectItem>
                          <SelectItem value="Entrada">Receita (Entrada)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="categoria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categoriasDisponiveis.map(c => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>

             <div className="grid grid-cols-2 gap-4">
                 <FormField
                  // @ts-ignore
                  control={form.control}
                  name="frequencia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequência</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Mensal">Mensal</SelectItem>
                          <SelectItem value="Semanal">Semanal</SelectItem>
                          <SelectItem value="Quinzenal">Quinzenal</SelectItem>
                          <SelectItem value="Anual">Anual</SelectItem>
                        </SelectContent>
                      </Select>
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
                            {RESPONSAVEIS.map(r => (
                                <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
             </div>

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : "Salvar Recorrência"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
