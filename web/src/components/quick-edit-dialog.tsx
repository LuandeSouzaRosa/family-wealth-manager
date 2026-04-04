"use client"

import * as React from "react"
import { useTransition, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { quickEditTransaction } from "@/actions/transactions"
import { Edit3, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

export function QuickEditTransactionDialog({ 
    transaction, 
    categoriasValidas = []
}: { 
    transaction: { id: string, categoria: string, responsavel: string, split_group_id?: string | null }, 
    categoriasValidas?: string[] 
}) {
  const [open, setOpen] = React.useState(false)
  const [categoria, setCategoria] = React.useState(transaction.categoria)
  const [responsavel, setResponsavel] = React.useState(transaction.responsavel || "Casal")
  const [isPending, startTransition] = useTransition()
  const isSubmittingRef = useRef(false)
  const router = useRouter()

  const CATEGORIAS_FALLBACK = ["Moradia", "Alimentação", "Transporte", "Saúde", "Educação", "Lazer", "Outros", "Salário", "Investimentos"]
  const categorias = categoriasValidas.length > 0 ? categoriasValidas : CATEGORIAS_FALLBACK

  const handleSave = () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    
    startTransition(async () => {
      try {
        const res = await quickEditTransaction(transaction.id, categoria, responsavel)
        if (res?.error) {
          alert(res.error)
        } else {
          setOpen(false)
          router.refresh()
        }
      } finally {
        isSubmittingRef.current = false;
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
          data-testid="btn-quick-edit-transaction"
        >
            <Edit3 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Revisão Rápida</DialogTitle>
          <DialogDescription>
            Ajuste a categoria ou responsável para afinar seus relatórios pós-importação.
            {transaction.split_group_id && " (Nota: Esta é uma fatia de Split. Os valores do rateio não serão alterados nesta edição)."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">Categoria</label>
            <div className="col-span-3">
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger data-testid="quick-edit-categoria">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
             <label className="text-right text-sm font-medium">Responsável</label>
             <div className="col-span-3">
               <Select value={responsavel} onValueChange={setResponsavel}>
                 <SelectTrigger data-testid="quick-edit-responsavel">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="Casal">Casal</SelectItem>
                   <SelectItem value="Luan">Luan</SelectItem>
                   <SelectItem value="Luana">Luana</SelectItem>
                 </SelectContent>
               </Select>
             </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isPending} data-testid="btn-quick-edit-salvar">
             {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
