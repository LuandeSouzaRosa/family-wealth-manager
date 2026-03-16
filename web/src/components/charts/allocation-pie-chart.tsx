"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { cn } from "@/lib/utils"

interface AllocationPieChartProps {
  data: {
    tipo?: string
    valor?: number
  }[]
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

export function AllocationPieChart({ data }: AllocationPieChartProps) {
  const validData = data
    ?.filter(item => item.valor && item.valor > 0)
    .map(item => ({
      name: item.tipo || 'Outros',
      value: item.valor
    }))
    .sort((a, b) => (b.value || 0) - (a.value || 0)) || []

  if (validData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm font-mono p-6 text-center">
        Nenhum investimento registrado para análise.
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
          <PieChart>
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
                 backgroundColor: 'hsl(var(--popover))', 
                 border: '1px solid hsl(var(--border))', 
                 borderRadius: 'var(--radius)',
                 boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                 color: 'hsl(var(--popover-foreground))'
               }}
               itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 500 }}
               cursor={{ fill: 'transparent' }}
            />
          </PieChart>
        </ResponsiveContainer>
         {/* Texto Central */}
         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
           <div className="text-center">
             <span className="text-2xl font-bold block text-foreground">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: "compact" }).format(total)}</span>
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
               + {validData.length - 5} outras classes menores
             </span>
           </div>
        )}
      </div>
    </div>
  )
}
