"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { CreditCard, Plus, Loader2 } from "lucide-react"

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createCartaoCredito } from "@/actions/finance"
import { toast } from "sonner"

import { CartaoSchema } from "@/lib/schemas"

export function AddCardDialog() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const form = useForm<z.infer<typeof CartaoSchema>>({
    resolver: zodResolver(CartaoSchema) as any,
    defaultValues: {
      nome: "",
      limite: 0,
      dia_fechamento: 1,
      dia_vencimento: 10,
      responsavel: "Todos",
      cor: "#000000",
    },
  })

  function onSubmit(values: z.infer<typeof CartaoSchema>) {
    startTransition(async () => {
      const formData = new FormData()
      formData.append("nome", values.nome)
      formData.append("limite", String(values.limite))
      formData.append("dia_fechamento", String(values.dia_fechamento))
      formData.append("dia_vencimento", String(values.dia_vencimento))
      formData.append("responsavel", values.responsavel)
      formData.append("cor", values.cor)

      const result = await createCartaoCredito(formData)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Cartão adicionado com sucesso!")
        setOpen(false)
        form.reset()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:opacity-90">
          <Plus className="h-4 w-4" /> Novo Cartão
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-full">
                <CreditCard className="w-5 h-5 text-primary" />
            </div>
            Adicionar Cartão de Crédito
          </DialogTitle>
          <DialogDescription>
            Cadastre seu cartão para controlar faturas e limites.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Cartão (Apelido)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Nubank Luan" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="limite"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Limite Total (R$)</FormLabel>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Todos">Todos</SelectItem>
                          <SelectItem value="Luan">Luan</SelectItem>
                          <SelectItem value="Esposa">Esposa</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dia_fechamento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dia Fechamento</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" max="31" placeholder="Dia" {...field} />
                      </FormControl>
                      <p className="text-[10px] text-muted-foreground">Melhor dia de compra</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  // @ts-ignore
                  control={form.control}
                  name="dia_vencimento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dia Vencimento</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" max="31" placeholder="Dia" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>

            <FormField
              control={form.control}
              name="cor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cor do Cartão</FormLabel>
                  <div className="flex gap-2">
                      <Input type="color" className="w-12 h-10 p-1 cursor-pointer" {...field} />
                      <div className="flex-1">
                          <Input readOnly value={field.value} className="font-mono" />
                      </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Cadastrar Cartão
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
