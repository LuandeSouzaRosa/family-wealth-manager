"use client"

import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { AddInvestimentoDialog } from '@/components/add-investimento-dialog'
import { EditInvestimentoDialog } from '@/components/edit-investimento-dialog'
import { AllocationPieChart } from '@/components/charts/allocation-pie-chart'
import { SmartAllocationWidget } from '@/components/investments/smart-allocation'
import { TrendingUp, PieChart, Wallet, Calendar, ArrowUpRight, DollarSign, Building2 } from 'lucide-react'
import { useTransition } from 'react'
import { deleteInvestimento, updateInvestimento } from '@/actions/investments'
import { useFilter } from '@/contexts/filter-context'

interface Investimento {
  id: string
  nome: string
  tipo: string
  instituicao: string
  valor_aplicado: number
  valor_atual: number
  quantidade: number
  data_aplicacao: string
  data_vencimento?: string
  liquidez?: string
  responsavel: string
}

interface InvestimentosClientProps {
  initialInvestimentos: Investimento[]
}

const SPRING_TRANSITION = { type: "spring" as const, bounce: 0.4, duration: 0.8 }

const fadeUpVariant = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: SPRING_TRANSITION }
}

const scaleUpVariant = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: SPRING_TRANSITION }
}

export function InvestimentosClientShell({ initialInvestimentos }: InvestimentosClientProps) {
  const [isPending, startTransition] = useTransition()
  const { responsavel } = useFilter()

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja remover este investimento?")) {
        startTransition(() => {
          deleteInvestimento(id)
        })
    }
  }

  // Filtragem
  const filteredInvestimentos = initialInvestimentos.filter(item => {
      if (responsavel === "Todos") return true
      return item.responsavel === responsavel || item.responsavel === "Casal"
  })

  // Cálculos
  const totalAplicado = filteredInvestimentos.reduce((acc, curr) => acc + curr.valor_aplicado, 0)
  const totalAtual = filteredInvestimentos.reduce((acc, curr) => acc + curr.valor_atual, 0)
  const rentabilidadeAbsoluta = totalAtual - totalAplicado
  const rentabilidadePercentual = totalAplicado > 0 ? (rentabilidadeAbsoluta / totalAplicado) * 100 : 0

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      className="max-w-7xl mx-auto space-y-8 px-6"
    >
      {/* Header */}
      <motion.div variants={fadeUpVariant} className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-foreground mb-2 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-primary opacity-80" />
            <span className="font-semibold text-primary">Portfólio</span> de Investimentos
          </h1>
          <p className="text-muted-foreground font-mono text-sm uppercase tracking-wider">
            XP INVESTIMENTOS & ALOCAÇÃO DE ATIVOS
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AddInvestimentoDialog />
        </div>
      </motion.div>

      {/* KPI Cards & Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: KPIs */}
        <motion.div variants={scaleUpVariant} className="grid grid-cols-1 md:grid-cols-2 gap-6 content-start">
            <Card className="md:col-span-2 bg-gradient-to-br from-background to-muted/20 border-border shadow-sm">
              <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Investido (Bruto)</CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="text-3xl font-bold text-foreground">{formatBRL(totalAtual)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Custo: {formatBRL(totalAplicado)}</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-background to-muted/20 border-border shadow-sm">
              <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Rentabilidade</CardTitle>
              </CardHeader>
              <CardContent>
                  <div className={`text-2xl font-bold ${rentabilidadeAbsoluta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {rentabilidadeAbsoluta >= 0 ? '+' : ''}{formatBRL(rentabilidadeAbsoluta)}
                  </div>
                  <div className={`text-xs mt-1 font-medium ${rentabilidadePercentual >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {rentabilidadePercentual.toFixed(2)}% de retorno
                  </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-background to-muted/20 border-border shadow-sm">
               <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Ativos na Carteira</CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold text-foreground">{filteredInvestimentos.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">Produtos Financeiros</div>
              </CardContent>
            </Card>
        </motion.div>

        {/* Right Column: Allocation Chart */}
        <motion.div variants={scaleUpVariant}>
            <Card className="h-full border border-border shadow-sm bg-card">
               <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <PieChart className="w-4 h-4" /> Alocação de Ativos
                  </CardTitle>
               </CardHeader>
               <CardContent className="h-[250px]">
                  <AllocationPieChart data={filteredInvestimentos.map(i => ({ tipo: i.tipo, valor: i.valor_atual }))} />
               </CardContent>
            </Card>
        </motion.div>
      </div>

      {/* Smart Allocation (Rebalanceamento) */}
      <motion.div variants={fadeUpVariant}>
        <SmartAllocationWidget investimentos={filteredInvestimentos} />
      </motion.div>

      {/* Tabela de Ativos */}
      <motion.div variants={fadeUpVariant} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
         <div className="p-6 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-lg flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" /> Meus Ativos
            </h3>
         </div>
         
         <div className="overflow-x-auto">
             <table className="w-full text-sm text-left">
                 <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-medium">
                     <tr>
                         <th className="px-6 py-4">Ativo</th>
                         <th className="px-6 py-4">Tipo</th>
                         <th className="px-6 py-4 text-right">Valor Atual</th>
                         <th className="px-6 py-4 text-right">Rentab.</th>
                         <th className="px-6 py-4 text-center">Vencimento</th>
                         <th className="px-6 py-4 text-right">Ações</th>
                     </tr>
                 </thead>
                 <tbody className="divide-y divide-border">
                     {filteredInvestimentos.length === 0 ? (
                         <tr>
                             <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                                 Nenhum investimento encontrado para este perfil.
                             </td>
                         </tr>
                     ) : (
                         filteredInvestimentos.map(item => {
                             const rentab = item.valor_atual - item.valor_aplicado
                             const rentabPerc = item.valor_aplicado > 0 ? (rentab / item.valor_aplicado) * 100 : 0
                             
                             return (
                                 <tr key={item.id} className="hover:bg-muted/30 transition-colors group">
                                     <td className="px-6 py-4">
                                         <div className="font-medium text-foreground">{item.nome}</div>
                                         <div className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Building2 size={10} /> {item.instituicao} • {item.responsavel}
                                         </div>
                                     </td>
                                     <td className="px-6 py-4">
                                         <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                             {item.tipo}
                                         </span>
                                     </td>
                                     <td className="px-6 py-4 text-right font-medium text-foreground">
                                         {formatBRL(item.valor_atual)}
                                     </td>
                                     <td className="px-6 py-4 text-right">
                                         <div className={`text-xs font-medium ${rentab >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                             {rentab >= 0 ? '+' : ''}{formatBRL(rentab)}
                                         </div>
                                         <div className={`text-[10px] ${rentab >= 0 ? 'text-emerald-600/70' : 'text-red-600/70'}`}>
                                             {rentabPerc.toFixed(2)}%
                                         </div>
                                     </td>
                                     <td className="px-6 py-4 text-center text-muted-foreground">
                                         {item.data_vencimento ? new Date(item.data_vencimento).toLocaleDateString('pt-BR') : '-'}
                                     </td>
                                     <td className="px-6 py-4 text-right">
                                         <div className="flex items-center justify-end gap-2">
                                            <EditInvestimentoDialog investimento={item} />
                                            <button 
                                               onClick={() => handleDelete(item.id)}
                                               disabled={isPending}
                                               className="text-muted-foreground hover:text-destructive transition-colors text-xs underline"
                                            >
                                                Remover
                                            </button>
                                         </div>
                                     </td>
                                 </tr>
                             )
                         })
                     )}
                 </tbody>
             </table>
         </div>
      </motion.div>

    </motion.div>
  )
}
