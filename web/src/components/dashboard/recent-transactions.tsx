"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'
import { TiltCard } from '@/components/ui/tilt-card'
import { FileText } from 'lucide-react'

interface Transaction {
  id: string
  descricao: string
  valor: number
  categoria: string
  tipo: string
  data: string
}

interface RecentTransactionsProps {
  transactions: Transaction[]
  responsavel: string
}

export function RecentTransactions({ transactions, responsavel }: RecentTransactionsProps) {
  return (
    <TiltCard intensity={5} className="h-full">
      <Card className="h-full border border-border/50 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm shadow-sm relative overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg font-medium">
              Histórico Recente {responsavel !== 'Todos' && <span className="text-sm font-normal text-muted-foreground ml-2">({responsavel})</span>}
          </CardTitle>
          <CardDescription>Últimas movimentações.</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center justify-center opacity-80">
               <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
               <p className="text-sm font-medium text-foreground">Seu histórico está limpo</p>
               <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">Adicione sua primeira transação para alimentar os relatórios.</p>
            </div>
          ) : (
            <motion.div 
              variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
              className="space-y-2"
            >
              {transactions.map((tx) => {
                const isIncome = tx.tipo === 'Entrada';
                const isInvestment = tx.tipo === 'Transferência';
                return (
                  <motion.div 
                    key={tx.id} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between group p-3 rounded-xl hover:bg-muted/50 transition-all duration-300 border border-transparent hover:border-border/50 hover:shadow-sm cursor-default"
                  >
                    <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${isIncome ? 'bg-primary' : isInvestment ? 'bg-blue-500' : 'bg-destructive'}`} />
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium leading-none group-hover:text-primary transition-colors">
                            {tx.descricao}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            {new Date(tx.data).toLocaleDateString('pt-BR')} • {tx.categoria}
                          </p>
                        </div>
                    </div>
                    <div className={`text-sm font-semibold tabular-nums ${isIncome ? 'text-primary' : isInvestment ? 'text-blue-500' : 'text-foreground/80'}`}>
                      {isIncome ? '+' : '-'}{formatCurrency(tx.valor)}
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </TiltCard>
  )
}