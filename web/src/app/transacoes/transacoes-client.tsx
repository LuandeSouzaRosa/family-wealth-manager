"use client"

import { useState, useTransition, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Trash2, Calendar, FileText, ArrowUpRight, ArrowDownRight, Edit3, Upload, Search, Filter, Download, Split } from 'lucide-react'
import { deleteTransaction } from "@/actions/transactions";
import { AddTransactionDialog } from '@/components/add-transaction-dialog'
import { QuickEditTransactionDialog } from '@/components/quick-edit-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useFilter } from '@/contexts/filter-context'
import { isResponsibleMatch } from '@/lib/filter-utils'
import { getYearFilterOptions } from '@/lib/period-range'
import { isAmbiguousReviewCandidate } from '@/lib/ambiguous-review'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { LatestImportedPeriodReading } from '@/lib/latest-imported-period-reading'

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
  initialMonth?: string
  initialYear?: string
  initialCategory?: string
  initialSort?: "date_desc" | "value_desc" | "value_asc"
  initialReview?: "all" | "ambiguous"
  initialResponsavelFromUrl?: "Todos" | "Luan" | "Luana" | "Casal" | null
  latestImportedPeriodReading?: LatestImportedPeriodReading | null
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

export function TransacoesClientShell({
  initialData,
  initialCartoes,
  initialMonth = "0",
  initialYear = new Date().getFullYear().toString(),
  initialCategory = "Todas",
  initialSort = "date_desc",
  initialReview = "all",
  initialResponsavelFromUrl = null,
  latestImportedPeriodReading = null,
}: TransacoesClientProps) {
  const { responsavel, setResponsavel } = useFilter()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [month, setMonth] = useState<string>(initialMonth) // 0 means all for the selected year
  const [year, setYear] = useState<string>(initialYear)

  // Hardening: Sincronize local state when URL changes via Browser Back/Forward
  useEffect(() => {
    setMonth(initialMonth)
    setYear(initialYear)
  }, [initialMonth, initialYear])

  useEffect(() => {
    if (!initialResponsavelFromUrl) return
    if (initialResponsavelFromUrl !== responsavel) {
      setResponsavel(initialResponsavelFromUrl)
    }
  }, [initialResponsavelFromUrl, responsavel, setResponsavel])

  // Context Persistence: Sincroniza a validade final (provada pela URL ou Cookie) com a memória de fallback
  useEffect(() => {
    document.cookie = `fwm_transacoes_period=${month}-${year}; path=/; max-age=2592000`; // Salva por 30 dias
  }, [month, year])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState(initialCategory)
  const [sortBy, setSortBy] = useState<"date_desc" | "value_desc" | "value_asc">(initialSort)
  const [visibleCount, setVisibleCount] = useState(30)
  const reviewPreset = initialReview === "ambiguous" ? "ambiguous" : "all"

  useEffect(() => {
    setSelectedCategory(initialCategory)
  }, [initialCategory])

  useEffect(() => {
    setSortBy(initialSort)
  }, [initialSort])

  useEffect(() => {
    setVisibleCount(30)
  }, [month, year, responsavel, searchTerm, selectedCategory, reviewPreset])

  const uniqueCategories = useMemo(() => {
    const cats = new Set(initialData.map(tx => tx.categoria))
    return Array.from(cats).sort()
  }, [initialData])

  const availableYears = useMemo(() => getYearFilterOptions(year), [year])

  // Note: For a fully Server-Side approach we would push router params (?month=X&year=Y)
  // For maximum fluidity + 0 latency, we filter the pre-fetched massive list locally if small enough,
  // or rely on the Server Action approach. Since FWM usually has < 500 tx/year, local filtering is instant.
  
  const filteredData = useMemo(() => {
    let result = initialData;

    // 1. Filtrar por Responsável
    if (responsavel !== "Todos") {
        result = result.filter(tx => isResponsibleMatch(tx.responsavel, responsavel))
    }

    // 2. Filtrar por Ano
    if (year !== "0") {
      result = result.filter(tx => new Date(tx.data).getFullYear().toString() === year)
    }

    // 3. Filtrar por Mês
    if (month !== "0") {
      result = result.filter(tx => (new Date(tx.data).getMonth() + 1).toString() === month)
    }

    if (reviewPreset === "ambiguous") {
      result = result.filter((tx) =>
        isAmbiguousReviewCandidate({
          categoria: tx.categoria,
          descricao: tx.descricao,
          tipo: tx.tipo,
          valor: tx.valor,
        })
      )
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

    // 6. Ordenar para priorizar revisão pós-import quando necessário
    if (sortBy === "value_desc") {
      result = [...result].sort((a, b) => b.valor - a.valor)
    } else if (sortBy === "value_asc") {
      result = [...result].sort((a, b) => a.valor - b.valor)
    }

    return result
  }, [initialData, month, year, responsavel, searchTerm, selectedCategory, sortBy, reviewPreset])

  const displayData = filteredData.slice(0, visibleCount)

  // Get month label for display
  const currentMonthLabel = MONTHS.find(m => m.value === month)?.label || "Mês"

  const totalEntradas = filteredData.filter(t => t.tipo === "Entrada").reduce((acc, curr) => acc + curr.valor, 0)
  const totalSaidas = filteredData.filter(t => t.tipo === "Saída").reduce((acc, curr) => acc + curr.valor, 0)
  const saldoPeriodo = totalEntradas - totalSaidas

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  const formatDate = (isoStr: string) => new Date(isoStr).toLocaleDateString('pt-BR')

  const buildTransacoesQuery = (
    nextMonth: string,
    nextYear: string,
    nextCategory: string,
    nextSort: "date_desc" | "value_desc" | "value_asc",
    options?: { includeReview?: boolean }
  ) => {
    const params = new URLSearchParams()
    params.set("month", nextMonth)
    params.set("year", nextYear)
    const includeReview = options?.includeReview ?? true
    if (reviewPreset === "ambiguous" && includeReview) params.set("review", "ambiguous")
    if (nextCategory !== "Todas") params.set("category", nextCategory)
    if (nextSort !== "date_desc") params.set("sort", nextSort)
    return `?${params.toString()}`
  }

  const handleDelete = (tx: Transaction) => {
    const isSplit = !!tx.split_group_id
    const msg = isSplit
      ? "⚠️ ATENÇÃO: Esta é uma transação dividida (Split).\n\nAo excluir, TODAS as partes que pertencem a este grupo serão apagadas simultaneamente.\n\nTem certeza que deseja continuar?"
      : "Tem certeza que deseja excluir este lançamento?"

    if(confirm(msg)) {
      startTransition(() => {
        deleteTransaction(tx.id)
      })
    }
  }

  const handleEditAttempt = (tx: Transaction) => {
    if (tx.split_group_id) {
       alert("Operação Não Suportada (V1)\n\nTransações divididas (Split) não podem ser editadas parcialmente. Para ajustar os valores, exclua o lançamento (o grupo inteiro será removido) e recrie.")
    } else {
       alert("Edição de transação será disponibilizada em breve nas próximas atualizações.")
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
        
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Button variant="outline" className="gap-2 hidden md:flex" onClick={handleExportCSV}>
              <Download size={16} /> Exportar
          </Button>
          <Link href="/conciliacao">
            <Button className="gap-2">
                <Upload size={16} /> Importar Extrato
            </Button>
          </Link>
          <AddTransactionDialog cartoes={initialCartoes} variant="secondary" />
        </div>
      </motion.div>

      {latestImportedPeriodReading && (
        <motion.div variants={scaleUpVariant}>
          <Card className="border border-border bg-card shadow-sm" data-testid="latest-imported-reading-card">
            <CardContent className="p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ultima leitura util do periodo importado ({latestImportedPeriodReading.periodLabel})
              </p>
              <p className="text-sm text-foreground">{latestImportedPeriodReading.primaryAttentionText}</p>
              {latestImportedPeriodReading.confidenceLimiterText && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Limitador atual: {latestImportedPeriodReading.confidenceLimiterText}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Proxima acao: {latestImportedPeriodReading.nextActionText}
              </p>
              <p className="text-xs text-muted-foreground">
                Ganho esperado: {latestImportedPeriodReading.expectedConfidenceImpact}
              </p>
              <p className="text-xs text-muted-foreground">
                Fortalecimento observado: {latestImportedPeriodReading.strengtheningText}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link href={latestImportedPeriodReading.nextActionHref}>
                  <Button variant="default" size="sm">
                    {latestImportedPeriodReading.nextActionLabel}
                  </Button>
                </Link>
                <Link href={latestImportedPeriodReading.periodReviewHref}>
                  <Button variant="outline" size="sm">
                    Abrir extrato do periodo
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

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
                  {reviewPreset === "ambiguous" && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
                      <div className="flex items-center justify-between gap-2">
                        <span>Modo revisao: ambiguos de maior impacto (Outros + PIX generico).</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[11px] text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
                          onClick={() => {
                            startTransition(() => {
                              router.push(buildTransacoesQuery(month, year, selectedCategory, sortBy, { includeReview: false }))
                            })
                          }}
                        >
                          Ver todas no periodo
                        </Button>
                      </div>
                    </div>
                  )}
                  
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
                        <Select value={year} onValueChange={(val) => {
                           const v = val || "0";
                           setYear(v);
                           startTransition(() => {
                               router.push(buildTransacoesQuery(month, v, selectedCategory, sortBy));
                           });
                        }}>
                          <SelectTrigger data-testid="filter-year" className="w-full bg-background border-input text-foreground h-10 px-3">
                            <span className="flex-1 min-w-0 truncate text-left">
                                {year === "0" ? "Todos" : year}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Todos</SelectItem>
                            {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mês</label>
                        <Select value={month} onValueChange={(val) => {
                           const v = val || "0";
                           setMonth(v);
                           startTransition(() => {
                               router.push(buildTransacoesQuery(v, year, selectedCategory, sortBy));
                           });
                        }}>
                          <SelectTrigger data-testid="filter-month" className="w-full bg-background border-input text-foreground h-10 px-3">
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
                    <Select value={selectedCategory} onValueChange={(val) => {
                      setSelectedCategory(val)
                      startTransition(() => {
                        router.push(buildTransacoesQuery(month, year, val, sortBy))
                      })
                    }}>
                      <SelectTrigger data-testid="filter-category" className="w-full bg-background border-input text-foreground h-10 px-3">
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

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ordenação</label>
                    <Select value={sortBy} onValueChange={(val) => {
                      const normalizedSort =
                        val === "value_desc" || val === "value_asc" ? val : "date_desc"
                      setSortBy(normalizedSort)
                      startTransition(() => {
                        router.push(buildTransacoesQuery(month, year, selectedCategory, normalizedSort))
                      })
                    }}>
                      <SelectTrigger data-testid="filter-sort" className="w-full bg-background border-input text-foreground h-10 px-3">
                        <span className="flex-1 min-w-0 truncate text-left">
                          {sortBy === "value_desc" ? "Maior valor" : sortBy === "value_asc" ? "Menor valor" : "Data mais recente"}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date_desc">Data mais recente</SelectItem>
                        <SelectItem value="value_desc">Maior valor</SelectItem>
                        <SelectItem value="value_asc">Menor valor</SelectItem>
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
                        <p className="text-xl font-light text-emerald-400" data-testid="extrato-total-entradas">{formatCurrency(totalEntradas)}</p>
                     </div>
                     <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20 w-full md:w-40 text-center md:text-left">
                        <p className="text-red-500 uppercase tracking-widest text-[10px] font-bold mb-1 flex items-center justify-center md:justify-start gap-1"><ArrowDownRight size={12}/> Despesas</p>
                        <p className="text-xl font-light text-red-400" data-testid="extrato-total-saidas">{formatCurrency(totalSaidas)}</p>
                     </div>
                  </div>
                </CardContent>
             </Card>
         </div>
      </motion.div>

      {/* Transactions List */}
      <Card className="border border-border shadow-sm bg-card overflow-hidden">
        
        {/* Desktop View (Table) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-muted text-muted-foreground tracking-wider">
              <tr>
                <th scope="col" className="px-3 py-3 md:px-6 md:py-4 font-medium">Data</th>
                <th scope="col" className="px-3 py-3 md:px-6 md:py-4 font-medium">Descrição</th>
                <th scope="col" className="px-3 py-3 md:px-6 md:py-4 font-medium">Categoria</th>
                <th scope="col" className="px-3 py-3 md:px-6 md:py-4 font-medium">Responsável</th>
                <th scope="col" className="px-3 py-3 md:px-6 md:py-4 font-medium text-right">Valor</th>
                <th scope="col" className="px-3 py-3 md:px-6 md:py-4 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {displayData.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="p-10 flex flex-col items-center justify-center text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                        <FileText className="w-8 h-8 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-xl font-medium tracking-tight">Comece importando seu extrato</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto">
                          O Family Wealth Manager é pensado para poupar seu tempo. Faça upload do arquivo CSV do seu banco para conciliar o mês de uma só vez.
                        </p>
                      </div>
                      <Link href="/conciliacao" className="mt-4">
                          <Button className="gap-2 shadow-sm">
                            <Upload size={16} /> Importar Extrato CSV
                          </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                displayData.map((tx, idx) => {
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
                      <td className="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap text-muted-foreground font-mono">
                        {formatDate(tx.data)}
                      </td>
                      <td className="px-3 py-3 md:px-6 md:py-4 font-medium text-foreground">
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-2">
                            {tx.descricao}
                          </span>
                          {tx.split_group_id && (
                            <span className="inline-flex w-fit items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 text-[10px] font-semibold uppercase tracking-wider">
                              <Split className="w-3 h-3" /> Parte de Despesa Dividida (Split)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 md:px-6 md:py-4">
                        <span className="px-2.5 py-0.5 rounded-full bg-secondary text-xs font-medium text-secondary-foreground border border-border">
                          {tx.categoria}
                        </span>
                      </td>
                      <td className="px-3 py-3 md:px-6 md:py-4">
                        <span className="px-2 py-0.5 rounded-md border border-border/50 text-[10px] text-muted-foreground whitespace-nowrap">
                          {tx.responsavel || "Casal"}
                        </span>
                      </td>
                      <td className={`px-3 py-3 md:px-6 md:py-4 text-right font-medium tabular-nums ${isIncome ? 'text-emerald-400' : 'text-foreground/90'}`}>
                        {isIncome ? '+' : '-'}{formatCurrency(tx.valor)}
                      </td>
                      <td className="px-3 py-3 md:px-6 md:py-4 text-center">
                        <div className="flex items-center justify-center gap-4 md:gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          
                          <QuickEditTransactionDialog 
                            transaction={{
                              id: tx.id,
                              categoria: tx.categoria,
                              responsavel: tx.responsavel || "Casal",
                              split_group_id: tx.split_group_id
                            }} 
                            categoriasValidas={uniqueCategories} 
                          />

                          <button 
                            disabled={isPending}
                            onClick={() => handleDelete(tx)}
                            className="p-1.5 rounded-md bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                            title={tx.split_group_id ? "Excluir Grupo Split Inteiro" : "Excluir Lançamento"}
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
            {filteredData.length > visibleCount && (
              <tfoot>
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center border-t border-border bg-background">
                    <Button variant="outline" size="sm" onClick={() => setVisibleCount(v => v + 30)} className="w-full max-w-sm rounded-[10px]">
                      Carregar mais lançamentos...
                    </Button>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Mobile View (Cards) */}
        <div className="md:hidden flex flex-col divide-y divide-border">
          {displayData.length === 0 ? (
            <div className="p-10 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <FileText className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-medium tracking-tight">Comece importando seu extrato</h3>
                <p className="text-muted-foreground w-full max-w-[250px] mx-auto text-sm">
                  Suba seu extrato CSV do banco para conciliar tudo de vez.
                </p>
              </div>
              <Link href="/conciliacao" className="mt-2">
                  <Button className="gap-2 shadow-sm text-xs h-9">
                    <Upload size={14} /> Importar Extrato
                  </Button>
              </Link>
            </div>
          ) : (
            <>
              {displayData.map((tx, idx) => {
              const isIncome = tx.tipo === 'Entrada'
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02, duration: 0.3 }}
                  key={`mob-${tx.id}`}
                  className="p-4 flex flex-col gap-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex flex-col gap-1 overflow-hidden">
                      <span className="font-medium text-foreground leading-tight">{tx.descricao}</span>
                      {tx.split_group_id && (
                        <span className="inline-flex w-fit items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 text-[10px] font-semibold uppercase tracking-wider">
                          <Split className="w-3 h-3" /> Split
                        </span>
                      )}
                    </div>
                    <span className={`font-semibold shrink-0 tabular-nums ${isIncome ? 'text-emerald-500' : 'text-foreground'}`}>
                      {isIncome ? '+' : '-'}{formatCurrency(tx.valor)}
                    </span>
                  </div>

                  <div className="flex items-center flex-wrap gap-2 mt-1">
                    <span className="text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-0.5 rounded-md">{formatDate(tx.data)}</span>
                    <span className="px-2 py-0.5 rounded-md bg-secondary text-[10px] font-medium text-secondary-foreground border border-border truncate max-w-[120px]">{tx.categoria}</span>
                    <span className="px-2 py-0.5 rounded-md border border-border/50 text-[10px] text-muted-foreground">{tx.responsavel || "Casal"}</span>
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-1 pt-3 border-t border-border/30">
                    <QuickEditTransactionDialog 
                      transaction={{
                        id: tx.id,
                        categoria: tx.categoria,
                        responsavel: tx.responsavel || "Casal",
                        split_group_id: tx.split_group_id
                      }} 
                      categoriasValidas={uniqueCategories} 
                    />

                    <button 
                      disabled={isPending}
                      onClick={() => handleDelete(tx)}
                      className="p-1.5 rounded-md bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors flex items-center gap-1.5 text-xs px-2.5 font-medium"
                      title={tx.split_group_id ? "Excluir Grupo Split Inteiro" : "Excluir Lançamento"}
                    >
                      <Trash2 size={13} />
                      Excluir
                    </button>
                  </div>
                </motion.div>
              )
              })}
              {filteredData.length > visibleCount && (
                <div className="p-4 flex justify-center bg-background border-t border-border">
                  <Button variant="outline" size="sm" onClick={() => setVisibleCount(v => v + 30)} className="w-full rounded-[10px]">
                    Carregar mais lançamentos...
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

    </motion.div>
  )
}
