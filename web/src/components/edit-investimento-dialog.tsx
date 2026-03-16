"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Edit2 } from "lucide-react"

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

import { updateInvestimento } from "@/actions/finance"

const formSchema = z.object({
  nome: z.string().min(2, { message: "Nome do ativo é obrigatório." }),
  valor_atual: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
    message: "Valor inválido.",
  }),
  quantidade: z.string().default("1"),
})

type FormSchemaType = z.infer<typeof formSchema>

interface EditInvestimentoDialogProps {
  investimento: {
    id: string
    nome: string
    valor_atual: number
    quantidade: number
  }
}

export function EditInvestimentoDialog({ investimento }: EditInvestimentoDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()

  // @ts-ignore
  const form = useForm<FormSchemaType>({
    // @ts-ignore
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: investimento.nome,
      valor_atual: String(investimento.valor_atual),
      quantidade: String(investimento.quantidade),
    },
  })

  // @ts-ignore
  function onSubmit(values: any) {
    startTransition(async () => {
      const formData = new FormData()
      formData.append("nome", values.nome)
      formData.append("valor_atual", values.valor_atual)
      formData.append("quantidade", values.quantidade)

      const result = await updateInvestimento(investimento.id, formData)

      if (result.error) {
        form.setError("root", { message: result.error })
      } else {
        setOpen(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-muted-foreground hover:text-primary transition-colors">
          <Edit2 className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Atualizar Investimento</DialogTitle>
          <DialogDescription>
            Ajuste o saldo atual ou quantidade do ativo.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <FormField
              // @ts-ignore
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Ativo</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
                <FormField
                  // @ts-ignore
                  control={form.control}
                  name="valor_atual"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Atual (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  // @ts-ignore
                  control={form.control}
                  name="quantidade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantidade</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.0001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : "Atualizar Saldo"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
