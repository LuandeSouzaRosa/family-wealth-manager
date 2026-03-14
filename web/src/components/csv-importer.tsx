'use client'

import { useState } from 'react'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createTransactionsBatch } from '@/actions/finance'
import { Upload, Check, AlertCircle, Loader2, FileSpreadsheet } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const CATEGORIAS = [
  "Alimentação", "Moradia", "Transporte", "Lazer", "Saúde", 
  "Educação", "Salário", "Investimentos", "Outros"
]

const RESPONSAVEIS = ["Casal", "Luan", "Luana"]

const parseMoney = (val: string) => {
  if (typeof val === 'number') return val;
  // Exemplo Nubank: "16.99" ou "-16.99"
  // Remove qualquer caractere que não seja número, ponto ou sinal de menos
  let cleanStr = String(val).replace(/[^0-9.,-]/g, '');
  
  // Se não tem vírgula, mas tem ponto (ex: 16.99 do Nubank), é um número float válido no formato US
  if (cleanStr.includes('.') && !cleanStr.includes(',')) {
      return parseFloat(cleanStr);
  }
  
  // Se tem vírgula, assumimos padrão brasileiro (ex: 1.200,50 ou 16,99)
  // Removemos todos os pontos e trocamos a última vírgula por ponto
  if (cleanStr.includes(',')) {
      cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
      return parseFloat(cleanStr);
  }

  return parseFloat(cleanStr) || 0;
}

const parseDate = (val: string) => {
  if (!val) return new Date().toISOString();
  // Formato Nubank DD/MM/YYYY
  const parts = val.split('/');
  if (parts.length === 3) {
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).toISOString();
  }
  return new Date(val).toISOString();
}

export function CsvImporter() {
  const [data, setData] = useState<any[]>([])
  const [fileName, setFileName] = useState<string>("")
  const [isUploading, setIsUploading] = useState(false)
  const [successMsg, setSuccessMsg] = useState("")

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setSuccessMsg("") // Limpa msg anterior
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const normalized = results.data.map((row: any, index) => ({
          id: index,
          data: parseDate(row['data'] || row['Data'] || row['date']),
          descricao: row['descricao'] || row['Descrição'] || row['description'] || "Sem descrição",
          valor: parseMoney(row['valor'] || row['Valor'] || row['value'] || "0"),
          categoria: "Outros",
          responsavel: "Casal",
          tipo: parseMoney(row['valor'] || row['Valor'] || row['value'] || "0") < 0 ? "Saída" : "Entrada"
        }))
        
        const cleanData = normalized.map(item => {
           let val = item.valor
           let tipo = item.tipo
           if (val < 0) {
             val = Math.abs(val)
             tipo = "Saída"
           }
           return { ...item, valor: val, tipo }
        })

        setData(cleanData)
      },
      error: (error) => {
        console.error(error)
        alert("Erro ao ler CSV")
      }
    })
  }

  const updateRow = (index: number, field: string, value: any) => {
    const newData = [...data]
    newData[index] = { ...newData[index], [field]: value }
    setData(newData)
  }

  const handleImport = async () => {
    setIsUploading(true)
    const payload = data.map(({ id, ...rest }) => rest)
    const result = await createTransactionsBatch(payload)
    setIsUploading(false)

    if (result.success) {
      setSuccessMsg(`${result.count} transações importadas com sucesso!`)
      setData([])
      setFileName("")
    } else {
      alert("Erro na importação: " + result.error)
    }
  }

  return (
    <div className="space-y-8">
      {/* Dropzone Area */}
      {!data.length && !successMsg && (
        <div 
          onClick={() => document.getElementById('csv-upload')?.click()}
          className="border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 bg-muted/30 hover:bg-muted/50 transition-all rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer text-center space-y-4 group"
        >
          <div className="p-4 rounded-full bg-background shadow-sm group-hover:scale-110 transition-transform">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Clique para selecionar ou arraste seu CSV</h3>
            <p className="text-sm text-muted-foreground mt-1">Compatível com Nubank, Itaú, Inter e padrão bancário</p>
          </div>
          <Input id="csv-upload" type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
        </div>
      )}

      {/* Preview Table */}
      {data.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileSpreadsheet className="h-5 w-5" />
              <span className="font-medium text-foreground">{fileName}</span>
              <span className="text-sm">({data.length} linhas)</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setData([])} className="text-destructive hover:text-destructive hover:bg-destructive/10">
              Cancelar
            </Button>
          </div>

          <div className="rounded-md border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Responsável</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{row.data}</TableCell>
                    <TableCell className="font-medium">{row.descricao}</TableCell>
                    <TableCell className={cn(
                      "font-semibold",
                      row.tipo === 'Saída' ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                    )}>
                      {row.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </TableCell>
                    <TableCell>
                       <Select value={row.tipo} onValueChange={(val) => updateRow(index, 'tipo', val)}>
                        <SelectTrigger className="h-8 w-[110px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Entrada">Entrada</SelectItem>
                          <SelectItem value="Saída">Saída</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={row.categoria} onValueChange={(val) => updateRow(index, 'categoria', val)}>
                        <SelectTrigger className="h-8 w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIAS.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={row.responsavel} onValueChange={(val) => updateRow(index, 'responsavel', val)}>
                        <SelectTrigger className="h-8 w-[130px] border-primary/20 bg-primary/5 text-primary-foreground dark:text-primary">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RESPONSAVEIS.map(r => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end pt-4">
             <Button onClick={handleImport} disabled={isUploading} size="lg" className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white">
                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Confirmar e Importar {data.length} Transações
             </Button>
          </div>
        </motion.div>
      )}

      {/* Success State */}
      {successMsg && (
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="p-8 border border-emerald-500/20 bg-emerald-500/10 rounded-xl flex flex-col items-center justify-center text-center space-y-4"
        >
          <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
            <Check className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400">Importação Concluída!</h3>
          <p className="text-muted-foreground">{successMsg}</p>
          <Button variant="outline" onClick={() => { setSuccessMsg(""); setData([]) }}>
            Importar Outro Arquivo
          </Button>
        </motion.div>
      )}
    </div>
  )
}
