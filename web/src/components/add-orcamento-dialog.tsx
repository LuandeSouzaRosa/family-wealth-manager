"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { PiggyBank, Plus } from "lucide-react"

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

import { createOrcamento } from "@/actions/finance"
import { CATEGORIAS_SAIDA, RESPONSAVEIS } from "@/lib/constants"

import { OrcamentoSchema } from "@/lib/schemas"

export function AddOrcamentoDialog() {
  const [open, setOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()

  const form = useForm<z.infer<typeof OrcamentoSchema>>({
    resolver: zodResolver(OrcamentoSchema) as any,
    defaultValues: {
      categoria: "",
      limite_mensal: 0,
      responsavel: "Casal",
    },
  })

  function onSubmit(values: z.infer<typeof OrcamentoSchema>) {
    startTransition(async () => {
      const formData = new FormData()
      formData.append("categoria", values.categoria)
      formData.append("limite_mensal", String(values.limite_mensal))
      formData.append("responsavel", values.responsavel)

      const result = await createOrcamento(formData)

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
          <Plus size={18} /> Novo Orçamento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
             <PiggyBank className="text-primary h-5 w-5" /> Definir Limite de Gastos
          </DialogTitle>
          <DialogDescription>
            Defina um teto de gastos mensal para uma categoria específica.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
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
                      {CATEGORIAS_SAIDA.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
                <FormField
                  // @ts-ignore
                  control={form.control}
                  name="limite_mensal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Limite Mensal (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
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
                {isPending ? "Salvando..." : "Criar Orçamento"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
