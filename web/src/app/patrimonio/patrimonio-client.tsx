"use client"

import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { AddPatrimonioDialog } from '@/components/add-patrimonio-dialog'
import { Trash2, Landmark, TrendingUp, TrendingDown, Building2, Car, CreditCard, PiggyBank, Briefcase } from 'lucide-react'
import { useTransition } from 'react'
import { deletePatrimonio } from '@/actions/finance'

interface Patrimonio {
  id: string
  item: string
  valor: number
  tipo: string
  categoria: string
  data_atualizacao: string
}

interface PatrimonioClientProps {
  patrimonio: Patrimonio[]
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

const IconMap: Record<string, any> = {
  "Conta Corrente": Landmark,
  "Investimento": TrendingUp,
  "Imóvel": Building2,
  "Veículo": Car,
  "Outros Bens": Briefcase,
  "Imobiliário": Building2,
  "Empréstimo": Landmark,
  "Cartão de Crédito": CreditCard,
  "Outras Dívidas": Briefcase,
}

export function PatrimonioClientShell({ patrimonio }: PatrimonioClientProps) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = (id: string) => {
    startTransition(() => {
      deletePatrimonio(id)
    })
  }

  const ativos = patrimonio.filter(p => p.tipo === "Ativo")
  const passivos = patrimonio.filter(p => p.tipo === "Passivo")

  const totalAtivos = ativos.reduce((acc, curr) => acc + curr.valor, 0)
  const totalPassivos = passivos.reduce((acc, curr) => acc + curr.valor, 0)
  const netWorth = totalAtivos - totalPassivos

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

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
            <PiggyBank className="h-8 w-8 text-primary opacity-80" />
            <span className="font-semibold text-primary">Patrimônio</span> Líquido
          </h1>
          <p className="text-muted-foreground font-mono text-sm uppercase tracking-wider">
            NET WORTH & PORTFOLIO TRACKER
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <AddPatrimonioDialog />
        </div>
      </motion.div>

      {/* Hero Net Worth Card */}
      <motion.div variants={scaleUpVariant} className="relative group">
         <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/30 to-primary/30 rounded-[2rem] blur opacity-50 group-hover:opacity-100 transition duration-1000" />
         <Card className="relative overflow-hidden border border-border bg-card shadow-sm rounded-[2rem]">
            <CardContent className="p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
              <div>
                 <p className="text-muted-foreground uppercase tracking-widest text-sm font-semibold mb-2">Seu Patrimônio Total</p>
                 <h2 className="text-5xl md:text-7xl font-bold tracking-tighter text-foreground">
                    {formatBRL(netWorth)}
                 </h2>
              </div>
              
              <div className="flex items-center gap-8 md:gap-12 w-full md:w-auto mt-6 md:mt-0 pt-6 md:pt-0 border-t border-border md:border-t-0">
                 <div className="text-center md:text-left">
                    <p className="text-emerald-500/80 uppercase tracking-widest text-xs font-semibold mb-1 flex items-center gap-1 justify-center md:justify-start"><TrendingUp size={14}/> Ativos (+)</p>
                    <p className="text-2xl md:text-3xl font-light text-emerald-400">{formatBRL(totalAtivos)}</p>
                 </div>
                 <div className="w-px h-12 bg-border hidden md:block" />
                 <div className="text-center md:text-left">
                    <p className="text-red-500/80 uppercase tracking-widest text-xs font-semibold mb-1 flex items-center gap-1 justify-center md:justify-start"><TrendingDown size={14}/> Passivos (-)</p>
                    <p className="text-2xl md:text-3xl font-light text-red-400">{formatBRL(totalPassivos)}</p>
                 </div>
              </div>
            </CardContent>
         </Card>
      </motion.div>

      {/* Lists Grid */}
      <div className="grid md:grid-cols-2 gap-8 pt-6">
        
        {/* Ativos */}
        <motion.div 
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
          className="space-y-4"
        >
           <motion.h3 variants={fadeUpVariant} className="text-xl font-light text-foreground flex items-center gap-2 mb-6">
             A Seus <span className="font-bold text-emerald-500">Ativos</span>
           </motion.h3>
           
           {ativos.length === 0 ? (
             <motion.div variants={fadeUpVariant} className="text-center py-8 text-muted-foreground border border-border rounded-2xl bg-card shadow-sm">
               Nenhum ativo declarado.
             </motion.div>
           ) : (
             ativos.map(item => (
                <ItemCard key={item.id} item={item} isPending={isPending} onDelete={handleDelete} color="emerald" />
             ))
           )}
        </motion.div>

        {/* Passivos */}
        <motion.div 
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
          className="space-y-4"
        >
           <motion.h3 variants={fadeUpVariant} className="text-xl font-light text-foreground flex items-center gap-2 mb-6">
             P Suas <span className="font-bold text-red-500">Dívidas</span>
           </motion.h3>
           
           {passivos.length === 0 ? (
             <motion.div variants={fadeUpVariant} className="text-center py-8 text-muted-foreground border border-border rounded-2xl bg-card shadow-sm">
               Nenhum passivo declarado. Parabéns!
             </motion.div>
           ) : (
             passivos.map(item => (
                <ItemCard key={item.id} item={item} isPending={isPending} onDelete={handleDelete} color="red" />
             ))
           )}
        </motion.div>

      </div>
    </motion.div>
  )
}

function ItemCard({ item, isPending, onDelete, color }: { item: Patrimonio, isPending: boolean, onDelete: (id: string) => void, color: 'emerald' | 'red' }) {
  const Icon = IconMap[item.categoria] || Briefcase
  const colorClass = color === 'emerald' ? 'text-emerald-400' : 'text-red-400'
  const bgSubtle = color === 'emerald' ? 'bg-emerald-500/10' : 'bg-red-500/10'

  return (
    <motion.div 
      variants={fadeUpVariant}
      whileHover={{ scale: 1.02, x: 4, transition: { type: "spring", stiffness: 400, damping: 25 } }}
    >
      <Card className="overflow-hidden border border-border bg-card shadow-sm transition-all duration-300 group">
        <CardContent className="p-4 flex items-center gap-4">
           <div className={`p-3 rounded-xl ${bgSubtle} ${colorClass}`}>
             <Icon size={20} />
           </div>
           
           <div className="flex-1">
             <h4 className="text-base font-medium text-foreground">{item.item}</h4>
             <p className="text-xs text-muted-foreground uppercase tracking-wider">{item.categoria}</p>
           </div>
           
           <div className="text-right">
             <p className={`text-lg font-light tracking-tight ${colorClass}`}>
               {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}
             </p>
           </div>

           <button 
             onClick={() => onDelete(item.id)}
             disabled={isPending}
             className="opacity-0 group-hover:opacity-100 ml-2 p-2 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all flex items-center justify-center"
             title="Excluir"
           >
             <Trash2 size={16} />
           </button>
        </CardContent>
      </Card>
    </motion.div>
  )
}
