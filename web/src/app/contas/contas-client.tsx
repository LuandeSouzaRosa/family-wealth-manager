"use client"

import { useState, useTransition } from "react"
import { createContaBancaria } from "@/actions/finance"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { useFilter } from "@/contexts/filter-context"

export function ContasClient({ initialContas }: { initialContas: any[] }) {
  const { responsavel: filtroResponsavel } = useFilter()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Estados do formulário
  const [nome, setNome] = useState("")
  const [instituicao, setInstituicao] = useState("")
  const [saldoAtual, setSaldoAtual] = useState("")
  const [responsavel, setResponsavel] = useState("Casal")

  // Filtra as contas exibidas na tela de acordo com o filtro global no topo
  const contasExibidas = initialContas.filter(c => {
      if (filtroResponsavel === "Todos") return true;
      return c.responsavel === filtroResponsavel;
  })

  const totalExibido = contasExibidas.reduce((acc, c) => acc + Number(c.saldo_atual), 0)

  const handleOpenCreate = () => {
    setNome("")
    setInstituicao("")
    setSaldoAtual("")
    setResponsavel("Casal")
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const formData = new FormData()
      formData.append("nome", nome)
      formData.append("instituicao", instituicao)
      formData.append("saldo_atual", saldoAtual || "0")
      formData.append("responsavel", responsavel)
      
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

      {/* Botão Nova Conta */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Minhas Contas</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Apelido da Conta (Ex: Nubank Luan)</Label>
                <Input 
                  id="nome" 
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="instituicao">Banco / Instituição</Label>
                  <Input 
                    id="instituicao" 
                    placeholder="Ex: Itaú" 
                    value={instituicao}
                    onChange={e => setInstituicao(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="saldo">Saldo Atual (R$)</Label>
                  <Input 
                    id="saldo" 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    value={saldoAtual}
                    onChange={e => setSaldoAtual(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>De quem é essa conta?</Label>
                <Select value={responsavel} onValueChange={setResponsavel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Luan">Luan</SelectItem>
                    <SelectItem value="Luana">Luana</SelectItem>
                    <SelectItem value="Casal">Conta Conjunta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Salvando..." : "Salvar Conta"}
                </Button>
              </DialogFooter>
            </form>
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