"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles, X, ChevronRight, TrendingUp, AlertTriangle, Lightbulb } from "lucide-react"
import { getFinancialAdvice } from "@/actions/ai-advisor"
import { toast } from "sonner"

export function AiAdvisorWidget({ responsavel = "Todos" }: { responsavel?: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [advice, setAdvice] = useState<any[]>([])

  const handleConsultAi = async () => {
    setIsLoading(true)
    setIsOpen(true)
    
    // Simular delay de pensamento da IA
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    const result = await getFinancialAdvice(responsavel)
    if ('error' in result) {
        toast.error("Erro ao consultar Assessor IA")
        setIsOpen(false)
    } else if ('advice' in result) {
        setAdvice(result.advice || [])
    }
    setIsLoading(false)
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="mb-4 w-full max-w-sm"
          >
            <Card className="border-primary/20 shadow-2xl bg-card/95 backdrop-blur-xl">
              <CardHeader className="pb-3 flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2 text-primary">
                    <Sparkles className="w-5 h-5" /> Assessor IA
                  </CardTitle>
                  <CardDescription>Análise inteligente das suas finanças</CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {isLoading ? (
                  <div className="space-y-3 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                    </div>
                    <p className="text-sm text-muted-foreground animate-pulse">Analisando seus gastos...</p>
                  </div>
                ) : (
                  advice.map((item, idx) => (
                    <motion.div 
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className={`p-3 rounded-lg border text-sm ${
                            item.type === 'warning' ? 'bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-300' :
                            item.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300' :
                            'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300'
                        }`}
                    >
                        <div className="flex items-center gap-2 font-medium mb-1">
                            {item.type === 'warning' && <AlertTriangle className="w-4 h-4" />}
                            {item.type === 'success' && <TrendingUp className="w-4 h-4" />}
                            {item.type === 'info' && <Lightbulb className="w-4 h-4" />}
                            {item.title}
                        </div>
                        <p className="opacity-90 leading-relaxed">{item.message}</p>
                    </motion.div>
                  ))
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={isOpen ? () => setIsOpen(false) : handleConsultAi}
        className="group relative flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-full shadow-lg shadow-indigo-500/25 transition-all duration-300"
      >
        <Sparkles className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        <span className="font-medium pr-1">
            {isOpen ? 'Fechar' : 'Consultar IA'}
        </span>
        
        {/* Glow Effect */}
        <span className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity blur-md -z-10"></span>
      </motion.button>
    </div>
  )
}
