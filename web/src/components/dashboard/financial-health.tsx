"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { formatCurrency } from "@/lib/utils"
import { TrendingUp, AlertTriangle, ShieldCheck, Zap, LineChart } from "lucide-react"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts"

interface FinancialHealthProps {
  metrics: {
    savingsRate: number
    runwayMonths: number
    financialFreedom: number
    avgBurnRate: number
    avgIncome: number
  }
  forecast: {
    month: string
    saldo: number
    entradas: number
    saidas: number
  }[]
}

export function FinancialHealthWidget({ metrics, forecast }: FinancialHealthProps) {
  // Cores baseadas na saúde financeira
  const savingsColor = metrics.savingsRate >= 20 ? "text-emerald-500" : metrics.savingsRate >= 0 ? "text-yellow-500" : "text-red-500";
  const runwayColor = metrics.runwayMonths >= 6 ? "text-emerald-500" : metrics.runwayMonths >= 3 ? "text-yellow-500" : "text-red-500";
  
  // Gráfico de Projeção
  const hasNegativeForecast = forecast.some(f => f.saldo < 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
      {/* Coluna 1: Indicadores de Saúde (KPIs) */}
      <Card className="border-l-4 border-l-emerald-500 shadow-sm bg-gradient-to-br from-background to-emerald-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            Saúde Financeira
          </CardTitle>
          <CardDescription>Análise baseada na sua média de gastos (Burn Rate)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          
          {/* Savings Rate */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-medium">
              <span className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="w-4 h-4" /> Taxa de Poupança
              </span>
              <span className={savingsColor}>{metrics.savingsRate.toFixed(1)}%</span>
            </div>
            <Progress value={Math.max(0, metrics.savingsRate)} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {metrics.savingsRate >= 20 
                ? "Excelente! Você está acumulando riqueza rápido." 
                : "Tente manter acima de 20% para acelerar seus objetivos."}
            </p>
          </div>

          {/* Runway (Reserva) */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-medium">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Zap className="w-4 h-4" /> Reserva de Emergência
              </span>
              <span className={runwayColor}>{metrics.runwayMonths.toFixed(1)} meses</span>
            </div>
            {/* Escala de 0 a 12 meses */}
            <Progress value={Math.min(100, (metrics.runwayMonths / 12) * 100)} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Seu custo de vida médio é <strong>{formatCurrency(metrics.avgBurnRate)}</strong>/mês.
            </p>
          </div>

        </CardContent>
      </Card>

      {/* Coluna 2: Projeção Futura (Forecast) */}
      <Card className={`shadow-sm border-l-4 ${hasNegativeForecast ? 'border-l-red-500' : 'border-l-blue-500'}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            {hasNegativeForecast ? <AlertTriangle className="w-5 h-5 text-red-500" /> : <LineChart className="w-5 h-5 text-blue-500" />}
            Projeção de Caixa (6 Meses)
          </CardTitle>
          <CardDescription>
             Baseado nas suas recorrências ativas
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[200px] w-full pt-4">
          {forecast.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecast}>
                  <defs>
                    <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorNegative" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="month" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                  <Tooltip 
                      formatter={(value: any) => formatCurrency(value)}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="saldo" 
                    stroke={hasNegativeForecast ? "#ef4444" : "#3b82f6"} 
                    strokeWidth={2}
                    fill={hasNegativeForecast ? "url(#colorNegative)" : "url(#colorSaldo)"} 
                  />
                </AreaChart>
              </ResponsiveContainer>
          ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground text-center">
                  Cadastre contas fixas (Recorrências) para ver a projeção futura.
              </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
