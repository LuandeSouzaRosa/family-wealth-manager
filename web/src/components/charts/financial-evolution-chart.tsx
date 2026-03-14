"use client"

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts"

interface FinancialEvolutionChartProps {
  data: {
    month: string
    acumulado: number
  }[]
}

export function FinancialEvolutionChart({ data }: FinancialEvolutionChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm font-mono p-6 text-center">
        Sem dados suficientes para gerar histórico.
      </div>
    )
  }

  // Formatar data para exibição (ex: "Jan 26")
  const formattedData = data.map(item => {
      const [year, month] = item.month.split('-')
      const date = new Date(parseInt(year), parseInt(month) - 1)
      return {
          ...item,
          label: date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
          acumulado: item.acumulado
      }
  })

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
        <XAxis 
            dataKey="label" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#888', fontSize: 12 }} 
            dy={10}
        />
        <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#888', fontSize: 12 }} 
            tickFormatter={(value) => `R$${(value/1000).toFixed(0)}k`}
        />
        <Tooltip 
           formatter={(value: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))}
           contentStyle={{ 
             backgroundColor: 'rgba(10, 10, 10, 0.9)', 
             border: '1px solid rgba(255,255,255,0.1)', 
             borderRadius: '12px',
             backdropFilter: 'blur(10px)',
             color: '#fff'
           }}
           labelStyle={{ color: '#aaa', marginBottom: '5px' }}
        />
        <Area 
            type="monotone" 
            dataKey="acumulado" 
            stroke="#10b981" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorSaldo)" 
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
