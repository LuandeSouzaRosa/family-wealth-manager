"use client"

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface Metric503020 {
  bucket: string
  total: number
}

interface NeedsWantsSavingsChartProps {
  data: Metric503020[]
}

const COLORS = {
  "Necessidades (50%)": "#3b82f6", // Blue
  "Desejos (30%)": "#f59e0b",      // Amber
  "Investimentos (20%)": "#10b981" // Emerald
}

const TARGETS = {
  "Necessidades (50%)": 50,
  "Desejos (30%)": 30,
  "Investimentos (20%)": 20
}

export function NeedsWantsSavingsChart({ data }: NeedsWantsSavingsChartProps) {
  // 1. Agregar dados (caso venha duplicado por user)
  const aggregated = data.reduce((acc, curr) => {
    const existing = acc.find(item => item.bucket === curr.bucket)
    if (existing) {
      existing.total += curr.total
    } else {
      acc.push({ ...curr })
    }
    return acc
  }, [] as Metric503020[])

  const totalGeral = aggregated.reduce((acc, curr) => acc + curr.total, 0)

  // 2. Ordenar
  const order = ["Necessidades (50%)", "Desejos (30%)", "Investimentos (20%)"]
  aggregated.sort((a, b) => order.indexOf(a.bucket) - order.indexOf(b.bucket))

  // 3. Calcular percentuais reais
  const metrics = order.map(bucketName => {
    const item = aggregated.find(i => i.bucket === bucketName)
    const total = item ? item.total : 0
    const percent = totalGeral > 0 ? (total / totalGeral) * 100 : 0
    const target = (TARGETS as any)[bucketName] || 0
    
    // Status de cor para a barra de progresso
    let statusColor = "bg-primary"
    if (bucketName.includes("Necessidades")) {
        // Se passar de 50%, alerta.
        statusColor = percent > 55 ? "bg-red-500" : "bg-blue-500"
    } else if (bucketName.includes("Desejos")) {
        // Se passar de 30%, alerta.
        statusColor = percent > 35 ? "bg-red-500" : "bg-amber-500"
    } else if (bucketName.includes("Investimentos")) {
        // Se for menor que 20%, alerta (ruim). Se maior, ótimo.
        statusColor = percent < 15 ? "bg-red-500" : "bg-emerald-500"
    }

    return {
      name: bucketName,
      total,
      percent,
      target,
      statusColor,
      fill: (COLORS as any)[bucketName]
    }
  })

  if (totalGeral === 0) {
     return (
       <div className="flex h-full items-center justify-center text-muted-foreground text-sm font-mono p-6 text-center">
         Nenhuma despesa categorizada este mês.
       </div>
     )
  }

  return (
    <div className="flex flex-col md:flex-row items-center gap-8 h-full w-full">
      {/* Gráfico Donut (Esquerda) */}
      <div className="w-full md:w-1/2 h-[250px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={metrics.filter(m => m.total > 0)}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="total"
              stroke="none"
              cornerRadius={5}
            >
              {metrics.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} className="stroke-background hover:opacity-80 transition-opacity" strokeWidth={2}/>
              ))}
            </Pie>
            <Tooltip 
               formatter={(value: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))}
               contentStyle={{ 
                 backgroundColor: 'rgba(10, 10, 10, 0.95)', 
                 border: '1px solid rgba(255,255,255,0.1)', 
                 borderRadius: '8px',
                 backdropFilter: 'blur(4px)'
               }}
               itemStyle={{ color: '#fff' }}
               cursor={{ fill: 'transparent' }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Texto Central */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <span className="text-2xl font-bold block">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: "compact" }).format(totalGeral)}</span>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Total</span>
          </div>
        </div>
      </div>

      {/* Barras de Progresso (Direita) */}
      <div className="w-full md:w-1/2 space-y-6 pr-4">
        {metrics.map((item) => (
          <div key={item.name} className="space-y-2">
            <div className="flex justify-between items-end text-sm">
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{item.name.split(' (')[0]}</span>
                <span className="text-xs text-muted-foreground">Meta: {item.target}%</span>
              </div>
              <div className="text-right">
                <span className="font-bold block">{item.percent.toFixed(1)}%</span>
                <span className="text-xs text-muted-foreground">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.total)}</span>
              </div>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                    className={cn("h-full transition-all duration-500 ease-out rounded-full", item.statusColor)} 
                    style={{ width: `${Math.min(item.percent, 100)}%` }}
                />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
