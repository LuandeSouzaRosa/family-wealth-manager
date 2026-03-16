"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Ghost, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative"
      >
        <div className="w-32 h-32 bg-muted/20 rounded-full flex items-center justify-center mb-6">
          <Ghost className="w-16 h-16 text-muted-foreground animate-bounce" />
        </div>
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="space-y-4 max-w-md"
      >
        <h1 className="text-4xl font-bold tracking-tight">404</h1>
        <h2 className="text-xl font-semibold text-muted-foreground">Página não encontrada</h2>
        <p className="text-sm text-muted-foreground">
          Parece que o ativo que você está procurando não está na nossa carteira.
        </p>
        
        <div className="pt-4">
          <Link href="/">
            <Button variant="default" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Voltar para o Dashboard
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
