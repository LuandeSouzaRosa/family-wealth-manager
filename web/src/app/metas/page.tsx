import { Suspense } from "react"
import { getMetas, createMeta, deleteMeta, updateMeta } from "@/actions/finance"
import { Button } from "@/components/ui/button"
import { Plus, Target, Trash2, Edit2, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/lib/utils"
import { MetasClient } from "./metas-client"

export default async function MetasPage() {
  const metas = await getMetas()

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Target className="h-8 w-8 text-primary" />
            Metas Financeiras
          </h1>
          <p className="text-muted-foreground mt-1">
            Defina objetivos e acompanhe o progresso dos seus sonhos.
          </p>
        </div>
      </div>

      <Suspense fallback={<div className="text-center py-10">Carregando metas...</div>}>
        <MetasClient initialMetas={metas} />
      </Suspense>
    </div>
  )
}