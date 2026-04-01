"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon, Plus, Split, Loader2 } from "lucide-react"

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
import { createTransaction, createSplitTransaction } from "@/actions/transactions"
import { getCategorias } from "@/actions/categories"
// CATEGORIAS_ENTRADA e CATEGORIAS_SAIDA removidos como fallback estático, usaremos dinâmico

import { TransactionSchema } from "@/lib/schemas"
import { useFilter } from "@/contexts/filter-context"
import { resolveResponsibleForNewTransaction } from "@/lib/filter-utils"

export function AddTransactionDialog({ children, cartoes = [], variant = "primary" }: { children?: React.ReactNode, cartoes?: any[], variant?: "primary" | "secondary" }) {
  const [open, setOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()
  const [contas, setContas] = React.useState<any[]>([])
  const [categoriasDB, setCategoriasDB] = React.useState<any[]>([])
  const [isSplit, setIsSplit] = React.useState(false)
  const [splitLuan, setSplitLuan] = React.useState("")
  const [splitLuana, setSplitLuana] = React.useState("")
  const isSubmittingRef = React.useRef(false)
  const { responsavel } = useFilter()

  React.useEffect(() => {
    if (open) {
      getContasBancarias().then(data => {
        if (data) setContas(data)
      })
      getCategorias().then(data => {
        if (data) setCategoriasDB(data)
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
      cartao_id: "none",
      responsavel: resolveResponsibleForNewTransaction(responsavel),
      status: "Realizado",
    },
  })

  // Assistir o 'tipo' para renderizar as categorias certas
  const tipoSelecionado = form.watch("tipo")

  React.useEffect(() => {
    if (!open) return
    form.setValue("responsavel", resolveResponsibleForNewTransaction(responsavel))
  }, [open, responsavel, form])

  function submitTransaction(values: z.infer<typeof TransactionSchema>) {
    startTransition(async () => {
      try {
        const formData = new FormData()
      formData.append("descricao", values.descricao)
      formData.append("valor", String(values.valor))
      formData.append("categoria", values.categoria)
      formData.append("tipo", values.tipo)
      formData.append("responsavel", values.responsavel || resolveResponsibleForNewTransaction(responsavel))
      if (values.data) {
          formData.append("data", values.data.toISOString())
      }
      
      if (values.conta_id && values.conta_id !== "none") {
        formData.append("conta_id", values.conta_id)
      }
      if (values.cartao_id && values.cartao_id !== "none") {
        formData.append("cartao_id", values.cartao_id)
      }

      let result: { error?: string; success?: boolean }

      try {
        if (isSplit) {
          formData.append("splits[0].responsavel", "Luan")
          formData.append("splits[0].valor", splitLuan)
          formData.append("splits[1].responsavel", "Luana")
          formData.append("splits[1].valor", splitLuana)
          result = await createSplitTransaction(formData)
        } else {
          result = await createTransaction(formData)
        }
      } catch (fatalError: any) {
        form.setError("root", { message: `[FATAL] ${fatalError.message || fatalError}` });
        return;
      }

      if (result.error) {
        form.setError("root", { message: result.error })
      } else {
        setOpen(false)
        form.reset()
        setIsSplit(false)
        setSplitLuan("")
        setSplitLuana("")
      }
      } finally {
        isSubmittingRef.current = false;
      }
    })
  }

  const handleInvalidSubmit = () => {
    isSubmittingRef.current = false
  }

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSubmittingRef.current || isPending) return

    // Lock acquired before RHF validation callback to avoid pre-callback re-entry.
    isSubmittingRef.current = true
    void form.handleSubmit(submitTransaction, handleInvalidSubmit)(e)
  }

  const triggerButton = (
    <Button 
      data-testid="btn-nova-transacao"
      variant={variant === "secondary" ? "outline" : "default"}
      className={cn(
        "h-12 px-6 rounded-xl font-semibold tracking-wide transition-all duration-300 w-full md:w-auto",
        variant === "primary" 
          ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)]" 
          : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
    >
      <div className="flex items-center gap-2">
        <div className={cn("p-1 rounded-full", variant === "primary" ? "bg-white/20" : "bg-primary/10")}>
            <Plus className={cn("w-4 h-4", variant === "secondary" && "text-primary")} />
        </div>
        <span>Lançamento Manual</span>
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
          <form onSubmit={handleFormSubmit} className="space-y-4">
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
                          {contas.filter((c: any) => c.id && c.id.trim() !== "").map(conta => (
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
                          if (val !== "none") form.setValue("conta_id", "none");
                      }} value={field.value || "none"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
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
                  render={({ field }) => {
                    // Filtrar categorias pelo tipo selecionado (ou "Ambos")
                    const categoriasFiltradas = categoriasDB.filter(
                      c => c.tipo === tipoSelecionado || c.tipo === "Ambos"
                    );
                    
                    return (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-categoria">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                           {categoriasFiltradas.length > 0 ? (
                               categoriasFiltradas
                                 .filter(cat => cat.nome && cat.nome.trim() !== "")
                                 .map(cat => (
                                   <SelectItem key={cat.id || cat.nome} value={cat.nome}>{cat.nome}</SelectItem>
                                 ))
                           ) : (
                               <SelectItem value="Outros">Outros</SelectItem>
                           )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}}
                />
            </div>

            <FormField
              control={form.control}
              name="responsavel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsável</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "Casal"} disabled={isSplit}>
                    <FormControl>
                      <SelectTrigger data-testid="select-responsavel">
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

            {/* Split Toggle (P3.12) */}
            <div className="border border-border rounded-lg p-3 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSplit}
                  onChange={(e) => {
                    setIsSplit(e.target.checked)
                    if (!e.target.checked) {
                      setSplitLuan("")
                      setSplitLuana("")
                    }
                  }}
                  className="rounded border-input"
                />
                <Split className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Dividir entre responsáveis</span>
              </label>

              {isSplit && (() => {
                const valorTotal = form.watch("valor") || 0
                const somaAtual = (parseFloat(splitLuan) || 0) + (parseFloat(splitLuana) || 0)
                const somaCorreta = valorTotal > 0 && Math.abs(somaAtual - valorTotal) < 0.01

                return (
                  <div className="space-y-3 pl-6">
                    <button
                      type="button"
                      onClick={() => {
                        const metade = (valorTotal / 2).toFixed(2)
                        setSplitLuan(metade)
                        setSplitLuana(metade)
                      }}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      ⚡ Dividir 50/50
                    </button>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Luan</label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={splitLuan}
                          onChange={(e) => setSplitLuan(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Luana</label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={splitLuana}
                          onChange={(e) => setSplitLuana(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className={cn(
                      "text-xs font-medium",
                      somaCorreta ? "text-emerald-500" : "text-red-500"
                    )}>
                      Soma: R$ {somaAtual.toFixed(2)} / R$ {valorTotal.toFixed(2)}
                      {!somaCorreta && valorTotal > 0 && " — valores não conferem"}
                    </div>
                  </div>
                )
              })()}
            </div>

            <DialogFooter>
              <Button 
                type="submit" 
                disabled={isPending || (isSplit && (() => {
                  const v = form.watch("valor") || 0
                  const s = (parseFloat(splitLuan) || 0) + (parseFloat(splitLuana) || 0)
                  return v <= 0 || Math.abs(s - v) >= 0.01
                })())} 
                data-testid="btn-salvar-transacao"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : isSplit ? "Salvar Split" : "Salvar Transação"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
