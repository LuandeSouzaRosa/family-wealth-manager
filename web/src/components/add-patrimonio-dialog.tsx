"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus } from "lucide-react"

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

import { createPatrimonio } from "@/actions/finance"

const CATEGORIAS_ATIVO = ["Conta Corrente", "Investimento", "Imóvel", "Veículo", "Outros Bens"]
const CATEGORIAS_PASSIVO = ["Imobiliário", "Veículo", "Empréstimo", "Cartão de Crédito", "Outras Dívidas"]

import { PatrimonioSchema } from "@/lib/schemas"

export function AddPatrimonioDialog() {
  const [open, setOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()

  const form = useForm<z.infer<typeof PatrimonioSchema>>({
    resolver: zodResolver(PatrimonioSchema) as any,
    defaultValues: {
      item: "",
      valor: 0,
      tipo: "Ativo",
      categoria: "",
      responsavel: "Casal",
    },
  })

  const tipoSelecionado = form.watch("tipo")

  function onSubmit(values: z.infer<typeof PatrimonioSchema>) {
    startTransition(async () => {
      const formData = new FormData()
      formData.append("item", values.item)
      formData.append("valor", String(values.valor))
      formData.append("categoria", values.categoria)
      formData.append("tipo", values.tipo)
      formData.append("responsavel", values.responsavel)

      const result = await createPatrimonio(formData)

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
        <Button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-6">
          <Plus className="mr-2 h-4 w-4" /> Novo Patrimônio
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Declarar Patrimônio</DialogTitle>
          <DialogDescription>
            Adicione um novo ativo (Bens/Direitos) ou passivo (Dívidas).
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {form.formState.errors.root && (
              <div className="p-3 mb-4 text-sm text-destructive-foreground bg-destructive/20 rounded-md border border-destructive/50">
                {form.formState.errors.root.message}
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
               <FormField
                  control={form.control}
                  name="responsavel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsável</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
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
            
               <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Ativo">Ativo (+)</SelectItem>
                          <SelectItem value="Passivo">Passivo (-)</SelectItem>
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
                           {tipoSelecionado === "Ativo" 
                            ? CATEGORIAS_ATIVO.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))
                            : CATEGORIAS_PASSIVO.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>

            <FormField
              control={form.control}
              name="item"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item (Descrição)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Apartamento, CDB Itaú..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="valor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="Ex: 50000.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="mt-6">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : "Salvar no Portfolio"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
