"use client"

import { useTransition, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, ArrowUpRight, ArrowDownRight, Zap, Sparkles } from "lucide-react"
import { createTransaction } from "@/actions/transactions"
import { parseQuickAdd } from "@/lib/quick-add-parser"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function QuickAddWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [isPending, startTransition] = useTransition()
  const isSubmittingRef = useRef(false)
  const [preview, setPreview] = useState<{
    descricao: string
    valor: number
    tipo: "Entrada" | "Saída"
    categoria: string
    data: Date
  } | null>(null)

  const handleInputChange = (value: string) => {
    setInputValue(value)
    if (value.trim().length > 1) {
      const parsed = parseQuickAdd(value)
      setPreview(parsed)
    } else {
      setPreview(null)
    }
  }

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (isSubmittingRef.current || !inputValue) return
    isSubmittingRef.current = true

    const parsed = parseQuickAdd(inputValue)
    if (!parsed) {
      toast.error("Ops, não consegui entender a frase. Tente assim: 'ifood 45' ou 'salário 3000'")
      return
    }

    startTransition(async () => {
      console.log("[DEBUG] QuickAdd: Iniciando formData...");
      const formData = new FormData()
      formData.append("descricao", parsed.descricao)
      formData.append("valor", String(parsed.valor))
      formData.append("tipo", parsed.tipo)
      formData.append("categoria", parsed.categoria)
      
      try {
        formData.append("data", parsed.data.toISOString())
      } catch (err) {
        console.error("[DEBUG] Erro local no toISOString (Quick Add):", err)
        toast.error("Erro interno ao processar a data.")
        return
      }
      
      formData.append("status", "Realizado")

      console.log("[DEBUG] QuickAdd: Chamando createTransaction...");
      try {
        const result = await createTransaction(formData)
        console.log("[DEBUG] QuickAdd: Retorno de createTransaction:", result);

        if ('error' in result) {
          toast.error(result.error)
        } else {
          const tipoLabel = parsed.tipo === "Entrada" ? "Receita" : "Despesa"
          toast.success(
            `${tipoLabel}: ${parsed.descricao} — R$ ${parsed.valor.toFixed(2)}`,
            { description: `Categoria: ${parsed.categoria}` }
          )
          setInputValue("")
          setPreview(null)
          setIsOpen(false)
        }
      } catch (fatalError: any) {
        console.error("[FATAL DEBUG] QuickAdd Crashou completamente o client during/after Server Action:", fatalError);
        // Exibimos o stack exato no browser
        toast.error(`[FATAL] ${fatalError.message || fatalError}`);
      } finally {
        isSubmittingRef.current = false;
      }
    })
  }

  const isToday = (d: Date) => {
    const today = new Date()
    return d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
  }

  const formatPreviewDate = (d: Date) => {
    if (isToday(d)) return "Hoje"
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth()) return "Ontem"
    return d.toLocaleDateString("pt-BR")
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
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" /> Adição Rápida
              </h3>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Sparkles className="w-3 h-3" /> Smart Parse
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                autoFocus
                placeholder={`Ex: "ifood 45 ontem" ou "salário 3000"`}
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                className="flex-1 h-12 text-base"
              />
              <Button
                type="submit"
                disabled={isPending || !preview}
                size="icon"
                className={cn(
                  "h-12 w-12 rounded-xl shrink-0",
                  preview?.tipo === "Entrada"
                    ? "bg-emerald-500 hover:bg-emerald-600"
                    : "bg-red-500 hover:bg-red-600"
                )}
              >
                {isPending ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : preview?.tipo === "Entrada" ? (
                  <ArrowUpRight className="w-6 h-6" />
                ) : (
                  <ArrowDownRight className="w-6 h-6" />
                )}
              </Button>
            </form>

            {/* Live Preview */}
            <AnimatePresence mode="wait">
              {preview ? (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 p-3 rounded-xl bg-muted/50 border border-border text-xs space-y-1"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-foreground">{preview.descricao}</span>
                    <span className={cn(
                      "font-bold tabular-nums",
                      preview.tipo === "Entrada" ? "text-emerald-500" : "text-red-500"
                    )}>
                      {preview.tipo === "Entrada" ? "+" : "-"}R$ {preview.valor.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex gap-3 text-muted-foreground">
                    <span>{preview.categoria}</span>
                    <span>•</span>
                    <span>{formatPreviewDate(preview.data)}</span>
                    <span>•</span>
                    <span>{preview.tipo}</span>
                  </div>
                </motion.div>
              ) : (
                <motion.p
                  key="hint"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-muted-foreground mt-2 text-center"
                >
                  Dica: "uber 23 ontem" • "salário 3000" • "mercado 120"
                </motion.p>
              )}
            </AnimatePresence>
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
