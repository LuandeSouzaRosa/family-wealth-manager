"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { CalendarIcon, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
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

import { createRecorrente } from "@/actions/finance"

// Categorias
const CATEGORIAS_ENTRADA = ["Salário", "Dividendos", "Bônus", "Extra", "Reembolso"]
const CATEGORIAS_SAIDA = ["Moradia", "Alimentação", "Lazer", "Saúde", "Transporte", "Investimento", "Assinaturas", "Educação", "Outros"]

const formSchema = z.object({
  descricao: z.string().min(2, {
    message: "A descrição deve ter pelo menos 2 caracteres.",
  }).max(200),
  valor: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "O valor deve ser um número positivo.",
  }),
  dia_vencimento: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 1 && Number(val) <= 31, {
    message: "Use um dia entre 1 e 31.",
  }),
  tipo: z.enum(["Entrada", "Saída"]),
  frequencia: z.enum(["Mensal", "Semanal", "Anual", "Quinzenal"]),
  categoria: z.string().min(1, { message: "Selecione uma categoria." }),
})

export function AddRecorrenteDialog() {
  const [open, setOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      descricao: "",
      valor: "",
      dia_vencimento: "1",
      tipo: "Saída",
      frequencia: "Mensal",
      categoria: "",
    },
  })

  const tipoSelecionado = form.watch("tipo")

  function onSubmit(values: z.infer<typeof formSchema>) {
    startTransition(async () => {
      const formData = new FormData()
      formData.append("descricao", values.descricao)
      formData.append("valor", values.valor)
      formData.append("categoria", values.categoria)
      formData.append("tipo", values.tipo)
      formData.append("frequencia", values.frequencia)
      formData.append("dia_vencimento", values.dia_vencimento)

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
      <DialogTrigger 
        data-testid="btn-nova-recorrencia"
        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-6"
      >
        <Plus className="mr-2 h-4 w-4" /> Nova Recorrência
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adicionar Recorrência</DialogTitle>
          <DialogDescription>
            Insira os detalhes da nova despesa fixa ou receita recorrente.
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
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-tipo-recorrente">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Entrada">Entrada</SelectItem>
                          <SelectItem value="Saída">Saída</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="frequencia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequência</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-frequencia-recorrente">
                            <SelectValue placeholder="Selecione..." />
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
            </div>

            <div className="grid grid-cols-2 gap-4">
                 <FormField
                  control={form.control}
                  name="dia_vencimento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dia Vencimento</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" max="31" placeholder="Ex: 5" {...field} data-testid="input-dia-vencimento" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
           
            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Aluguel" {...field} data-testid="input-descricao-recorrente" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            </div>

            <div className="grid grid-cols-2 gap-4">
                 <FormField
                  control={form.control}
                  name="valor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-valor-recorrente" />
                      </FormControl>
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
                          <SelectTrigger data-testid="select-categoria-recorrente">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                           {tipoSelecionado === "Entrada" 
                            ? CATEGORIAS_ENTRADA.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))
                            : CATEGORIAS_SAIDA.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isPending} data-testid="btn-salvar-recorrencia">
                {isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
