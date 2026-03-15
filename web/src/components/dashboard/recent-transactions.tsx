"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'

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
    <Card className="border border-border shadow-sm bg-card">
      <CardHeader>
        <CardTitle className="text-lg font-medium">
            Histórico Recente {responsavel !== 'Todos' && <span className="text-sm font-normal text-muted-foreground ml-2">({responsavel})</span>}
        </CardTitle>
        <CardDescription>Últimas movimentações.</CardDescription>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="text-center py-12">
             <p className="text-sm text-muted-foreground">Nenhuma transação registrada para este filtro.</p>
          </div>
        ) : (
          <motion.div 
            variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
            className="space-y-6"
          >
            {transactions.map((tx) => {
              const isIncome = tx.tipo === 'Entrada';
              const isInvestment = tx.tipo === 'Transferência';
              return (
                <motion.div 
                  key={tx.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start justify-between group p-2 rounded-lg hover:bg-muted/50 transition-colors -mx-2 cursor-default"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none group-hover:text-primary transition-colors">
                      {tx.descricao}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.data).toLocaleDateString('pt-BR')} • {tx.categoria}
                    </p>
                  </div>
                  <div className={`text-sm font-medium tabular-nums ${isIncome ? 'text-primary' : isInvestment ? 'text-blue-500' : 'text-foreground/80'}`}>
                    {isIncome ? '+' : '-'}{formatCurrency(tx.valor)}
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}