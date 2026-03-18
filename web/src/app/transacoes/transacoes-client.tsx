"use client"

import { useState, useTransition, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Trash2, Calendar, FileText, ArrowUpRight, ArrowDownRight, Edit3, Upload, Search, Filter, Download, Split } from 'lucide-react'
import { deleteTransaction } from "@/actions/transactions";
import { AddTransactionDialog } from '@/components/add-transaction-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useFilter } from '@/contexts/filter-context'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface Transaction {
  id: string
  descricao: string
  valor: number
  categoria: string
  tipo: string
  data: string
  responsavel?: string
  split_group_id?: string | null
}

interface TransacoesClientProps {
  initialData: Transaction[]
  initialCartoes: any[]
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

const MONTHS = [
  { value: "0", label: "Todos" },
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
]

const YEARS = ["2026", "2025", "2024"]

export function TransacoesClientShell({ initialData, initialCartoes }: TransacoesClientProps) {
  const { responsavel } = useFilter()
  const [isPending, startTransition] = useTransition()
  const [month, setMonth] = useState<string>("0") // 0 means all for the selected year
  const [year, setYear] = useState<string>(new Date().getFullYear().toString())
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("Todas")

  const uniqueCategories = useMemo(() => {
    const cats = new Set(initialData.map(tx => tx.categoria))
    return Array.from(cats).sort()
  }, [initialData])

  // Note: For a fully Server-Side approach we would push router params (?month=X&year=Y)
  // For maximum fluidity + 0 latency, we filter the pre-fetched massive list locally if small enough,
  // or rely on the Server Action approach. Since FWM usually has < 500 tx/year, local filtering is instant.
  
  const filteredData = useMemo(() => {
    let result = initialData;

    // 1. Filtrar por Responsável
    if (responsavel !== "Todos") {
        result = result.filter(tx => tx.responsavel?.toLowerCase() === responsavel.toLowerCase())
    }

    // 2. Filtrar por Ano
    if (year !== "0") {
      result = result.filter(tx => new Date(tx.data).getFullYear().toString() === year)
    }

    // 3. Filtrar por Mês
    if (month !== "0") {
      result = result.filter(tx => (new Date(tx.data).getMonth() + 1).toString() === month)
    }

    // 4. Filtrar por Termo de Busca
    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      result = result.filter(tx => 
        tx.descricao.toLowerCase().includes(lower) || 
        tx.valor.toString().includes(lower)
      )
    }

    // 5. Filtrar por Categoria
    if (selectedCategory !== "Todas") {
      result = result.filter(tx => tx.categoria === selectedCategory)
    }

    return result
  }, [initialData, month, year, responsavel, searchTerm, selectedCategory])

  // Get month label for display
  const currentMonthLabel = MONTHS.find(m => m.value === month)?.label || "Mês"

  const totalEntradas = filteredData.filter(t => t.tipo === "Entrada").reduce((acc, curr) => acc + curr.valor, 0)
  const totalSaidas = filteredData.filter(t => t.tipo === "Saída").reduce((acc, curr) => acc + curr.valor, 0)
  const saldoPeriodo = totalEntradas - totalSaidas

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  const formatDate = (isoStr: string) => new Date(isoStr).toLocaleDateString('pt-BR')

  const handleDelete = (id: string) => {
    if(confirm("Tem certeza que deseja excluir este lançamento?")) {
      startTransition(() => {
        deleteTransaction(id)
      })
    }
  }

  const handleExportCSV = () => {
    const headers = ["Data", "Descrição", "Categoria", "Valor", "Tipo", "Responsável"]
    const rows = filteredData.map(tx => [
      new Date(tx.data).toLocaleDateString('pt-BR'),
      tx.descricao,
      tx.categoria,
      tx.valor.toFixed(2).replace('.', ','),
      tx.tipo,
      tx.responsavel || ""
    ])

    const csvContent = [
      headers.join(";"),
      ...rows.map(r => r.join(";"))
    ].join("\n")

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `extrato_export_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      className="max-w-6xl mx-auto space-y-8"
    >
      {/* Header & Actions */}
      <motion.div variants={fadeUpVariant} className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
        <div className="absolute -inset-4 bg-primary/5 blur-3xl -z-10 rounded-[3rem]" />
        
        <div>
          <h1 className="text-3xl font-light tracking-tight text-foreground mb-2 flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary opacity-80" />
            <span className="font-semibold text-primary">Extrato</span> Detalhado
          </h1>
          <p className="text-muted-foreground font-mono text-sm uppercase tracking-wider">
            HISTÓRICO COMPLETO DE MOVIMENTAÇÕES
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2 hidden md:flex" onClick={handleExportCSV}>
              <Download size={16} /> Exportar
          </Button>
          <Link href="/conciliacao">
            <Button variant="outline" className="gap-2">
                <Upload size={16} /> Importar CSV
            </Button>
          </Link>
          <AddTransactionDialog cartoes={initialCartoes} />
        </div>
      </motion.div>

      {/* Filters & Summary Dashboard */}
      <motion.div variants={scaleUpVariant} className="grid grid-cols-1 md:grid-cols-12 gap-6">
         {/* Filters Box */}
         <div className="md:col-span-4 lg:col-span-3 space-y-4">
            <Card className="border border-border bg-card shadow-sm h-full">
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center gap-2 mb-4 border-b border-border pb-4">
                  <Filter className="text-primary w-5 h-5" />
                  <h3 className="text-foreground font-medium tracking-tight">Filtros Avançados</h3>
                </div>
                
                <div className="space-y-4">
                  
                  {/* Busca */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Buscar</label>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Descrição ou valor..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 bg-background border-input" 
                        />
                    </div>
                  </div>

                  {/* Periodo */}
                  <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ano</label>
                        <Select value={year} onValueChange={(val) => setYear(val || "0")}>
                          <SelectTrigger className="w-full bg-background border-input text-foreground h-10 px-3">
                            <span className="flex-1 min-w-0 truncate text-left">
                                {year === "0" ? "Todos" : year}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Todos</SelectItem>
                            {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mês</label>
                        <Select value={month} onValueChange={(val) => setMonth(val || "0")}>
                          <SelectTrigger className="w-full bg-background border-input text-foreground h-10 px-3">
                            <span className="flex-1 min-w-0 truncate text-left">
                                {MONTHS.find(m => m.value === month)?.label || "Mês"}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                  </div>

                  {/* Categoria */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categoria</label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-full bg-background border-input text-foreground h-10 px-3">
                        <span className="flex-1 min-w-0 truncate text-left">
                            {selectedCategory === "Todas" ? "Todas as Categorias" : selectedCategory}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Todas">Todas as Categorias</SelectItem>
                        {uniqueCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                </div>
              </CardContent>
            </Card>
         </div>

         {/* Summary Box */}
         <div className="md:col-span-8 lg:col-span-9">
             <Card className="border border-border bg-card shadow-sm h-full relative overflow-hidden group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/10 to-primary/10 rounded-2xl blur opacity-50 transition duration-1000" />
                <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8 h-full relative z-10">
                  <div className="w-full">
                     <p className="text-muted-foreground uppercase tracking-widest text-sm font-semibold mb-2">
                        Resultado do Período {responsavel !== 'Todos' && `(${responsavel})`}
                     </p>
                     <h2 className={`text-4xl md:text-5xl font-bold tracking-tighter ${saldoPeriodo >= 0 ? 'text-foreground' : 'text-red-400'}`}>
                        {formatCurrency(saldoPeriodo)}
                     </h2>
                     <p className="text-muted-foreground text-sm mt-2">{filteredData.length} transações encontradas</p>
                  </div>
                  
                  <div className="flex items-center gap-6 w-full md:w-auto">
                     <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 w-full md:w-40 text-center md:text-left">
                        <p className="text-emerald-500 uppercase tracking-widest text-[10px] font-bold mb-1 flex items-center justify-center md:justify-start gap-1"><ArrowUpRight size={12}/> Receitas</p>
                        <p className="text-xl font-light text-emerald-400">{formatCurrency(totalEntradas)}</p>
                     </div>
                     <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20 w-full md:w-40 text-center md:text-left">
                        <p className="text-red-500 uppercase tracking-widest text-[10px] font-bold mb-1 flex items-center justify-center md:justify-start gap-1"><ArrowDownRight size={12}/> Despesas</p>
                        <p className="text-xl font-light text-red-400">{formatCurrency(totalSaidas)}</p>
                     </div>
                  </div>
                </CardContent>
             </Card>
         </div>
      </motion.div>

      {/* Transactions List */}
      <Card className="border border-border shadow-sm bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-muted text-muted-foreground tracking-wider">
              <tr>
                <th scope="col" className="px-6 py-4 font-medium">Data</th>
                <th scope="col" className="px-6 py-4 font-medium">Descrição</th>
                <th scope="col" className="px-6 py-4 font-medium">Categoria</th>
                <th scope="col" className="px-6 py-4 font-medium text-right">Valor</th>
                <th scope="col" className="px-6 py-4 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    Nenhuma transação encontrada para este período.
                  </td>
                </tr>
              ) : (
                filteredData.map((tx, idx) => {
                  const isIncome = tx.tipo === 'Entrada'
                  return (
                    <motion.tr 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.02, duration: 0.3 }}
                      key={tx.id} 
                      className="border-b border-border hover:bg-muted/50 transition-colors group"
                      data-testid="transaction-row"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground font-mono">
                        {formatDate(tx.data)}
                      </td>
                      <td className="px-6 py-4 font-medium text-foreground">
                        <span className="flex items-center gap-2">
                          {tx.descricao}
                          {tx.split_group_id && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wider">
                              <Split className="w-3 h-3" /> Split
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-0.5 rounded-full bg-secondary text-xs font-medium text-secondary-foreground border border-border">
                          {tx.categoria}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-right font-medium tabular-nums ${isIncome ? 'text-emerald-400' : 'text-foreground/90'}`}>
                        {isIncome ? '+' : '-'}{formatCurrency(tx.valor)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            disabled={isPending}
                            onClick={() => handleDelete(tx.id)}
                            className="p-1.5 rounded-md bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                            title="Excluir Lançamento"
                            data-testid="btn-delete-transaction"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

    </motion.div>
  )
}
