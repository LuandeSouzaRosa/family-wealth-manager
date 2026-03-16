"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, X, ArrowUpRight, ArrowDownRight, Zap } from "lucide-react"
import { createTransaction } from "@/actions/transactions"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function QuickAddWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [isPending, setIsPending] = useState(false)
  const [type, setType] = useState<"Saída" | "Entrada">("Saída")

  // Parser inteligente de texto natural
  // Ex: "50 almoço" -> { valor: 50, descricao: "almoço" }
  const parseInput = (text: string) => {
    // Regex para capturar o primeiro número (inteiro ou decimal)
    const valueMatch = text.match(/(\d+([.,]\d+)?)/)
    
    if (!valueMatch) return null

    const valorStr = valueMatch[0].replace(',', '.')
    const valor = parseFloat(valorStr)
    
    // O resto é descrição
    const descricao = text.replace(valueMatch[0], '').trim() || "Gasto Rápido"

    return { valor, descricao }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!inputValue) return

    const parsed = parseInput(inputValue)
    if (!parsed) {
        toast.error("Não entendi o valor. Digite ex: '50 almoço'")
        return
    }

    setIsPending(true)
    
    const formData = new FormData()
    formData.append("descricao", parsed.descricao)
    formData.append("valor", String(parsed.valor))
    formData.append("tipo", type)
    formData.append("categoria", "Outros") // Categoria padrão
    formData.append("data", new Date().toISOString())
    formData.append("responsavel", "Casal") // Padrão
    formData.append("status", "Realizado")

    const result = await createTransaction(formData)

    if (result.error) {
        toast.error(result.error)
    } else {
        toast.success(`Transação de R$ ${parsed.valor} adicionada!`)
        setInputValue("")
        setIsOpen(false)
    }
    setIsPending(false)
  }

  return (
    <div className="fixed bottom-24 right-6 z-40 md:hidden">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="mb-4 w-[calc(100vw-3rem)] max-w-sm bg-background/95 backdrop-blur-xl border border-border shadow-2xl rounded-2xl p-4"
          >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" /> Adição Rápida
                </h3>
                <div className="flex bg-muted rounded-lg p-1">
                    <button 
                        onClick={() => setType("Saída")}
                        className={cn(
                            "px-3 py-1 text-xs font-medium rounded-md transition-all",
                            type === "Saída" ? "bg-red-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Saída
                    </button>
                    <button 
                        onClick={() => setType("Entrada")}
                        className={cn(
                            "px-3 py-1 text-xs font-medium rounded-md transition-all",
                            type === "Entrada" ? "bg-emerald-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Entrada
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2">
                <Input 
                    autoFocus
                    placeholder="Ex: 25.90 Padaria"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="flex-1 h-12 text-lg"
                />
                <Button 
                    type="submit" 
                    disabled={isPending}
                    size="icon" 
                    className={cn(
                        "h-12 w-12 rounded-xl shrink-0",
                        type === "Saída" ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600"
                    )}
                >
                    {isPending ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        type === "Saída" ? <ArrowDownRight className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />
                    )}
                </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2 text-center">
                Dica: Digite o valor e o nome (ex: "50 Gasolina")
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
            "h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300",
            isOpen ? "bg-muted text-foreground rotate-45" : "bg-primary text-primary-foreground"
        )}
      >
        <Plus className="w-7 h-7" />
      </motion.button>
    </div>
  )
}
