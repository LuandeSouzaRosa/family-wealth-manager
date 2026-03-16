"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon, Plus } from "lucide-react"

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

import { getContasBancarias } from "@/actions/accounts"
import { createTransaction } from "@/actions/transactions"
import { CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA } from "@/lib/constants"

import { TransactionSchema } from "@/lib/schemas"

export function AddTransactionDialog({ children, cartoes = [] }: { children?: React.ReactNode, cartoes?: any[] }) {
  const [open, setOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()
  const [contas, setContas] = React.useState<any[]>([])

  React.useEffect(() => {
    if (open) {
      getContasBancarias().then(data => {
        if (data) setContas(data)
      })
    }
  }, [open])

  const form = useForm<z.infer<typeof TransactionSchema>>({
    resolver: zodResolver(TransactionSchema) as any,
    defaultValues: {
      descricao: "",
      valor: 0,
      tipo: "Saída",
      categoria: "",
      data: new Date(),
      conta_id: "none",
      cartao_id: "",
      status: "Realizado",
    },
  })

  // Assistir o 'tipo' para renderizar as categorias certas
  const tipoSelecionado = form.watch("tipo")

  function onSubmit(values: z.infer<typeof TransactionSchema>) {
    startTransition(async () => {
      // Usar FormData para enviar para a Server Action
      const formData = new FormData()
      formData.append("descricao", values.descricao)
      formData.append("valor", String(values.valor))
      formData.append("categoria", values.categoria)
      formData.append("tipo", values.tipo)
      if (values.data) {
          formData.append("data", values.data.toISOString())
      }
      
      // Lógica de seleção de conta/cartão simplificada
      // O schema centralizado já tem os campos opcionais
      if (values.conta_id && values.conta_id !== "none") {
        formData.append("conta_id", values.conta_id)
      }
      if (values.cartao_id) {
        formData.append("cartao_id", values.cartao_id)
      }

      const result = await createTransaction(formData)

      if (result.error) {
        form.setError("root", { message: result.error })
      } else {
        setOpen(false)
        form.reset()
      }
    })
  }

  const triggerButton = (
    <Button 
      data-testid="btn-nova-transacao"
      className="h-12 px-6 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] transition-all duration-300 font-semibold tracking-wide"
    >
      <div className="flex items-center gap-2">
        <div className="p-1 bg-white/20 rounded-full">
            <Plus className="w-4 h-4" />
        </div>
        <span>Nova Transação</span>
      </div>
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ? (children as React.ReactElement) : triggerButton}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adicionar Transação</DialogTitle>
          <DialogDescription>
            Insira os detalhes da nova receita ou despesa.
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
                      <FormLabel>Tipo de Transação</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-tipo">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Entrada">Entrada</SelectItem>
                          <SelectItem value="Saída">Saída</SelectItem>
                          <SelectItem value="Transferência">Transferência</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="data"
                  render={({ field }) => (
                    <FormItem className="flex flex-col pt-2.5">
                      <FormLabel>Data</FormLabel>
                      <Popover>
                        <FormControl>
                          <PopoverTrigger
                            className={cn(
                              "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PP", { locale: ptBR })
                            ) : (
                              <span>Escolha uma data</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </PopoverTrigger>
                        </FormControl>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
           
            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Conta de Luz" {...field} data-testid="input-descricao" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Seleção de Método de Pagamento (Apenas para Saída ou Geral) */}
            <div className="grid grid-cols-2 gap-4">
                 <FormField
                  control={form.control}
                  name="conta_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conta Bancária</FormLabel>
                      <Select onValueChange={(val) => {
                          field.onChange(val);
                          if (val !== "none") form.setValue("cartao_id", null);
                      }} value={field.value || "none"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sem conta / Cartão</SelectItem>
                          {contas.map(conta => (
                            <SelectItem key={conta.id} value={conta.id}>
                              {conta.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cartao_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ou Cartão de Crédito</FormLabel>
                      <Select onValueChange={(val) => {
                          field.onChange(val);
                          if (val) form.setValue("conta_id", "none");
                      }} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Nenhum</SelectItem>
                          {cartoes.map(cartao => (
                            <SelectItem key={cartao.id} value={cartao.id}>
                              {cartao.nome}
                            </SelectItem>
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
                  control={form.control}
                  name="valor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-valor" />
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
                          <SelectTrigger data-testid="select-categoria">
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
              <Button type="submit" disabled={isPending} data-testid="btn-salvar-transacao">
                {isPending ? "Salvando..." : "Salvar Transação"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
