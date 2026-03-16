"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createContaBancaria } from "@/actions/accounts";
import { Button } from "@/components/ui/button"
import { Plus, Building2, User, Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { useFilter } from "@/contexts/filter-context"
import { ContaSchema } from "@/lib/schemas"

export function ContasClient({ initialContas }: { initialContas: any[] }) {
  const { responsavel: filtroResponsavel } = useFilter()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const form = useForm<z.infer<typeof ContaSchema>>({
    resolver: zodResolver(ContaSchema) as any,
    defaultValues: {
      nome: "",
      instituicao: "",
      saldo_atual: 0,
      responsavel: "Casal",
      cor: "#10b981",
    },
  })

  // Filtra as contas exibidas na tela de acordo com o filtro global no topo
  const contasExibidas = initialContas.filter(c => {
      if (filtroResponsavel === "Todos") return true;
      return c.responsavel === filtroResponsavel;
  })

  const totalExibido = contasExibidas.reduce((acc, c) => acc + Number(c.saldo_atual), 0)

  const handleOpenCreate = () => {
    form.reset({
      nome: "",
      instituicao: "",
      saldo_atual: 0,
      responsavel: "Casal",
      cor: "#10b981",
    })
    setIsDialogOpen(true)
  }

  const handleSubmit = (values: z.infer<typeof ContaSchema>) => {
    startTransition(async () => {
      const formData = new FormData()
      formData.append("nome", values.nome)
      formData.append("instituicao", values.instituicao || "")
      formData.append("saldo_atual", String(values.saldo_atual))
      formData.append("responsavel", values.responsavel)
      formData.append("cor", values.cor)
      
      const result = await createContaBancaria(formData)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Conta criada com sucesso!")
        setIsDialogOpen(false)
        window.location.reload() // Atualiza a página para pegar dados novos
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* Resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-primary/10 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary">Saldo Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(totalExibido)}</div>
            <p className="text-xs text-muted-foreground">Somando as {contasExibidas.length} contas abaixo</p>
          </CardContent>
        </Card>
      </div>

import { PluggyConnectButton } from "@/components/pluggy-connect-button"

export function ContasClient({ initialContas }: { initialContas: any[] }) {
// ...
// (código existente)

      {/* Botão Nova Conta */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Minhas Contas</h2>
        <div className="flex gap-2">
            <PluggyConnectButton />
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
// ...
// (restante do código)
          <DialogTrigger asChild>
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Conta Bancária</DialogTitle>
              <DialogDescription>
                Cadastre uma nova conta para acompanhar o saldo real.
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apelido da Conta (Ex: Nubank Luan)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="instituicao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Banco / Instituição</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Itaú" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="saldo_atual"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Saldo Atual (R$)</FormLabel>
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
                  name="responsavel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>De quem é essa conta?</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Luan">Luan</SelectItem>
                          <SelectItem value="Luana">Luana</SelectItem>
                          <SelectItem value="Casal">Conta Conjunta</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Salvando..." : "Salvar Conta"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de Contas */}
      {contasExibidas.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Nenhuma conta encontrada</h3>
          <p className="text-muted-foreground">Cadastre sua primeira conta bancária.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {contasExibidas.map((conta) => (
            <motion.div
              key={conta.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="overflow-hidden border-t-4 shadow-sm hover:shadow-md transition-shadow" style={{ borderTopColor: conta.cor }}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{conta.nome}</CardTitle>
                        <CardDescription>{conta.instituicao}</CardDescription>
                      </div>
                      <div className="bg-muted px-2 py-1 rounded text-xs flex items-center gap-1 font-medium">
                          {conta.responsavel === "Casal" ? <Users className="w-3 h-3"/> : <User className="w-3 h-3"/>}
                          {conta.responsavel}
                      </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-light tracking-tight tabular-nums mt-4">
                    {formatCurrency(conta.saldo_atual)}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}