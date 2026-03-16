"use client"

import { useEffect } from "react"
import { motion } from "framer-motion"
import { AlertTriangle, RefreshCcw, Home } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Logar erro para serviço de monitoramento se necessário
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full bg-card border border-border/50 rounded-2xl shadow-xl p-8"
      >
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold mb-2">Ops! Algo deu errado</h2>
        <p className="text-muted-foreground mb-6 text-sm">
          Encontramos uma inconsistência no processamento dos seus dados. Não se preocupe, seu patrimônio está seguro.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <div className="bg-muted/50 p-4 rounded-md text-left mb-6 overflow-auto max-h-40 text-xs font-mono text-red-500">
            {error.message}
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => reset()} variant="default" className="gap-2 w-full sm:w-auto">
            <RefreshCcw className="w-4 h-4" /> Tentar Novamente
          </Button>
          <Button onClick={() => window.location.href = '/'} variant="outline" className="gap-2 w-full sm:w-auto">
            <Home className="w-4 h-4" /> Ir para Início
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
