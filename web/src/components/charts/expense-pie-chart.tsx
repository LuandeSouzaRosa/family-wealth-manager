"use client"

import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { PieChart } from 'lucide-react'
import { cn } from "@/lib/utils"

interface ExpensePieChartProps {
  data: {
    categoria?: string
    gasto?: number
  }[]
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

export function ExpensePieChart({ data }: ExpensePieChartProps) {
  const validData = data
    ?.filter(item => item.gasto && item.gasto > 0)
    .map(item => ({
      name: item.categoria || 'Outros',
      value: item.gasto
    }))
    .sort((a, b) => (b.value || 0) - (a.value || 0)) || []

  if (validData.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-muted-foreground text-center p-6 opacity-60">
        <PieChart className="w-10 h-10 mb-2 opacity-20" />
        <p className="text-sm font-medium text-foreground">Sem dados suficientes</p>
        <p className="text-xs">Registre suas despesas para analisar a distribuição do fluxo.</p>
      </div>
    )
  }

  const total = validData.reduce((acc, curr) => acc + (curr.value || 0), 0)

  // Top 5 categorias para a legenda lateral
  const topCategories = validData.slice(0, 5)

  return (
    <div className="flex flex-col md:flex-row items-center gap-8 h-full w-full">
      {/* Gráfico Donut */}
      <div className="w-full md:w-1/2 h-[250px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPieChart>
            <Pie
              data={validData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              stroke="none"
              cornerRadius={6}
            >
              {validData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[index % COLORS.length]} 
                  className="stroke-background hover:opacity-80 transition-opacity duration-300"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip 
               formatter={(value: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))}
               contentStyle={{ 
                 backgroundColor: 'rgba(10, 10, 10, 0.95)', 
                 border: '1px solid rgba(255,255,255,0.1)', 
                 borderRadius: '12px',
                 backdropFilter: 'blur(12px)',
                 boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
               }}
               itemStyle={{ color: '#fff', fontWeight: 500 }}
               cursor={{ fill: 'transparent' }}
            />
          </RechartsPieChart>
        </ResponsiveContainer>
         {/* Texto Central */}
         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
           <div className="text-center">
             <span className="text-2xl font-bold block">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: "compact" }).format(total)}</span>
             <span className="text-xs text-muted-foreground uppercase tracking-wider">Total</span>
           </div>
         </div>
      </div>

      {/* Lista Lateral (Legenda Rica) */}
      <div className="w-full md:w-1/2 space-y-4 pr-4">
        {topCategories.map((item, index) => {
          const percent = total > 0 ? ((item.value || 0) / total) * 100 : 0
          const color = COLORS[index % COLORS.length]
          
          return (
            <div key={index} className="flex items-center justify-between text-sm group cursor-default">
              <div className="flex items-center gap-3">
                <div 
                  className="w-3 h-3 rounded-full transition-transform group-hover:scale-125" 
                  style={{ backgroundColor: color }}
                />
                <span className="font-medium text-foreground/90">{item.name}</span>
              </div>
              <div className="text-right flex items-center gap-3">
                 <span className="text-muted-foreground text-xs">{percent.toFixed(1)}%</span>
                 <span className="font-mono tabular-nums text-foreground">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.value || 0)}</span>
              </div>
            </div>
          )
        })}
        {validData.length > 5 && (
           <div className="pt-2 text-center">
             <span className="text-xs text-muted-foreground italic">
               + {validData.length - 5} outras categorias menores
             </span>
           </div>
        )}
      </div>
    </div>
  )
}
