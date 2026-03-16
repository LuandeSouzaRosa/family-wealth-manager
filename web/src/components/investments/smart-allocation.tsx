"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { formatCurrency } from "@/lib/utils"
import { PieChart, TrendingUp, ArrowRight, RefreshCw, Calculator } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface SmartAllocationProps {
  investimentos: any[]
}

type AllocationTarget = {
  categoria: string
  target: number // 0 to 100
}

export function SmartAllocationWidget({ investimentos }: SmartAllocationProps) {
  const [aporte, setAporte] = useState<string>("")
  const [targets, setTargets] = useState<AllocationTarget[]>([])
  const [showSimulator, setShowSimulator] = useState(false)

  // 1. Identificar categorias existentes
  const categorias = Array.from(new Set(investimentos.map(i => i.tipo))).sort()
  
  // 2. Calcular alocação atual
  const totalAtual = investimentos.reduce((acc, i) => acc + Number(i.valor_atual), 0)
  
  const currentAllocation = categorias.map(cat => {
    const totalCat = investimentos
      .filter(i => i.tipo === cat)
      .reduce((acc, i) => acc + Number(i.valor_atual), 0)
    
    return {
      categoria: cat,
      valor: totalCat,
      percent: totalAtual > 0 ? (totalCat / totalAtual) * 100 : 0
    }
  })

  // 3. Inicializar targets (Recuperar do localStorage ou sugerir igualitário)
  useEffect(() => {
    const saved = localStorage.getItem("allocation-targets")
    if (saved) {
      setTargets(JSON.parse(saved))
    } else {
      const initial = categorias.map(c => ({ categoria: c, target: Math.floor(100 / categorias.length) }))
      // Ajustar sobra para o último
      const sum = initial.reduce((acc, i) => acc + i.target, 0)
      if (sum < 100 && initial.length > 0) {
        initial[initial.length - 1].target += (100 - sum)
      }
      setTargets(initial)
    }
  }, [investimentos])

  // 4. Salvar targets
  const handleTargetChange = (cat: string, val: number) => {
    const newTargets = targets.map(t => t.categoria === cat ? { ...t, target: val } : t)
    setTargets(newTargets)
    localStorage.setItem("allocation-targets", JSON.stringify(newTargets))
  }

  // 5. Calcular sugestão de aporte (Algoritmo de Rebalanceamento Inteligente)
  const calcularSugestao = () => {
    const valorAporte = parseFloat(aporte)
    if (isNaN(valorAporte) || valorAporte <= 0) return []

    const novoTotal = totalAtual + valorAporte
    
    // Quanto cada categoria DEVERIA ter no final
    const sugestoes = targets.map(t => {
      const idealValue = novoTotal * (t.target / 100)
      const currentValue = currentAllocation.find(c => c.categoria === t.categoria)?.valor || 0
      
      // Diferença necessária
      let comprar = idealValue - currentValue
      
      // Não sugerir venda (rebalanceamento apenas com aporte, tax efficient)
      // Se comprar for negativo, significa que está overweight, então compra 0
      if (comprar < 0) comprar = 0
      
      return {
        categoria: t.categoria,
        comprar: comprar,
        currentPercent: currentAllocation.find(c => c.categoria === t.categoria)?.percent || 0,
        targetPercent: t.target
      }
    })

    // Normalizar para caber no aporte disponível
    const totalSugestao = sugestoes.reduce((acc, s) => acc + s.comprar, 0)
    
    if (totalSugestao === 0) return [] // Caso raro onde tudo está super acima (não deve acontecer com aporte positivo)

    return sugestoes.map(s => ({
      ...s,
      comprarReal: (s.comprar / totalSugestao) * valorAporte
    })).sort((a, b) => b.comprarReal - a.comprarReal) // Priorizar maiores compras
  }

  const sugestoes = calcularSugestao()
  const totalTargets = targets.reduce((acc, t) => acc + t.target, 0)

  if (categorias.length === 0) return null

  return (
    <Card className="border border-border shadow-sm bg-gradient-to-br from-background to-muted/20">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowSimulator(!showSimulator)}>
        <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-light flex items-center gap-2 text-foreground">
            <Calculator className="text-primary w-5 h-5" /> Rebalanceamento Inteligente
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {showSimulator ? <ArrowRight className="h-4 w-4 rotate-90" /> : <ArrowRight className="h-4 w-4" />}
            </Button>
        </div>
        <CardDescription>Defina sua carteira ideal e descubra onde investir seu próximo aporte.</CardDescription>
      </CardHeader>
      
      <AnimatePresence>
        {showSimulator && (
            <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
            >
            <CardContent className="space-y-6 pt-4 border-t border-border/50 mt-2">
                
                {/* 1. Definição de Targets */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h4 className="text-sm font-medium text-muted-foreground">Sua Alocação Ideal (Metas %)</h4>
                        <span className={`text-xs font-bold ${totalTargets === 100 ? 'text-emerald-500' : 'text-red-500'}`}>
                            Total: {totalTargets}%
                        </span>
                    </div>
                    <div className="grid gap-4">
                        {targets.map(t => (
                            <div key={t.categoria} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span>{t.categoria}</span>
                                    <span className="text-muted-foreground">{t.target}% (Atual: {currentAllocation.find(c => c.categoria === t.categoria)?.percent.toFixed(1)}%)</span>
                                </div>
                                <Slider 
                                    value={[t.target]} 
                                    max={100} 
                                    step={5} 
                                    onValueChange={(val) => handleTargetChange(t.categoria, val[0])}
                                    className="py-1"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. Simulação de Aporte */}
                <div className="space-y-3 pt-4 border-t border-border/50">
                    <h4 className="text-sm font-medium text-muted-foreground">Vai investir hoje?</h4>
                    <div className="flex gap-2">
                        <Input 
                            type="number" 
                            placeholder="Valor do Aporte (R$)" 
                            value={aporte}
                            onChange={(e) => setAporte(e.target.value)}
                            className="flex-1"
                        />
                    </div>
                </div>

                {/* 3. Resultado (Sugestão) */}
                {sugestoes.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-border/50 animate-in fade-in slide-in-from-bottom-2">
                        <h4 className="text-sm font-medium text-emerald-500 flex items-center gap-2">
                            <RefreshCw className="w-4 h-4" /> Sugestão de Compra
                        </h4>
                        <div className="grid gap-2">
                            {sugestoes.map(s => (
                                <div key={s.categoria} className="flex justify-between items-center bg-card border border-border/50 p-2 rounded-md">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm">{s.categoria}</span>
                                        <span className="text-xs text-muted-foreground">
                                            Alvo: {s.targetPercent}%
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="block font-bold text-emerald-600">
                                            + {formatCurrency(s.comprarReal)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground text-center pt-2">
                            * Cálculo baseado em rebalanceamento via aporte (sem vendas) para eficiência tributária.
                        </p>
                    </div>
                )}

            </CardContent>
            </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
