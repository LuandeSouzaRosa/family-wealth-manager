"use client"

import { useState, useEffect } from "react"
import { getCategorias, createCategoria, deleteCategoria } from "@/actions/categories"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Plus, Tag } from "lucide-react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"

export function CategoriasClient() {
  const [categorias, setCategorias] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newCatName, setNewCatName] = useState("")
  const [newCatType, setNewCatType] = useState("Saída")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadData = async () => {
    setIsLoading(true)
    const data = await getCategorias()
    setCategorias(data || [])
    setIsLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCatName) return

    setIsSubmitting(true)
    const formData = new FormData()
    formData.append("nome", newCatName)
    formData.append("tipo", newCatType)
    formData.append("cor", "#64748b") // Default color for now
    formData.append("icone", "tag")   // Default icon

    const result = await createCategoria(formData)
    
    if (result.error) {
        toast.error(result.error)
    } else {
        toast.success("Categoria criada!")
        setNewCatName("")
        loadData()
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza? Transações antigas com essa categoria manterão o nome histórico, mas ela não aparecerá mais para novas.")) return

    const result = await deleteCategoria(id)
    if (result.error) {
        toast.error("Erro ao excluir: " + result.error)
    } else {
        toast.success("Categoria removida")
        setCategorias(prev => prev.filter(c => c.id !== id))
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Categorias</h1>
        <p className="text-muted-foreground">Gerencie as categorias usadas para classificar suas transações.</p>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Nova Categoria</CardTitle>
            <CardDescription>Adicione categorias personalizadas para organizar melhor seus gastos.</CardDescription>
        </CardHeader>
        <CardContent>
            <form onSubmit={handleCreate} className="flex gap-4 items-end">
                <div className="flex-1 space-y-2">
                    <label className="text-sm font-medium">Nome</label>
                    <Input 
                        placeholder="Ex: Viagens, Hobby, Pet..." 
                        value={newCatName}
                        onChange={e => setNewCatName(e.target.value)}
                    />
                </div>
                <div className="w-[150px] space-y-2">
                    <label className="text-sm font-medium">Tipo</label>
                    <Select value={newCatType} onValueChange={setNewCatType}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Saída">Saída</SelectItem>
                            <SelectItem value="Entrada">Entrada</SelectItem>
                            <SelectItem value="Ambos">Ambos</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Salvando..." : <><Plus className="w-4 h-4 mr-2" /> Adicionar</>}
                </Button>
            </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Entradas */}
        <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2 text-emerald-600">
                <div className="w-2 h-2 rounded-full bg-emerald-500" /> Entradas
            </h3>
            <div className="space-y-2">
                <AnimatePresence>
                    {categorias.filter(c => c.tipo === 'Entrada' || c.tipo === 'Ambos').map(cat => (
                        <motion.div 
                            key={cat.id}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex items-center justify-between p-3 bg-card border border-border rounded-lg shadow-sm group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-muted rounded-md">
                                    <Tag className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <span className="font-medium">{cat.nome}</span>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDelete(cat.id)}
                                className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>

        {/* Saídas */}
        <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2 text-red-600">
                <div className="w-2 h-2 rounded-full bg-red-500" /> Saídas
            </h3>
            <div className="space-y-2">
                <AnimatePresence>
                    {categorias.filter(c => c.tipo === 'Saída' || c.tipo === 'Ambos').map(cat => (
                        <motion.div 
                            key={cat.id}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex items-center justify-between p-3 bg-card border border-border rounded-lg shadow-sm group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-muted rounded-md">
                                    <Tag className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <span className="font-medium">{cat.nome}</span>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDelete(cat.id)}
                                className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
      </div>
    </div>
  )
}
