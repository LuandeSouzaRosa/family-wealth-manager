'use client'

import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createTransactionsBatch } from '@/actions/transactions'
import { getCategorizationRules, createCategorizationRule, getContasBancarias } from '@/actions/finance'
import { Upload, Check, AlertCircle, Loader2, FileSpreadsheet, PlusCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Checkbox } from "@/components/ui/checkbox"

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
  const [isUploading, setIsUploading] = useState(false)
  const [data, setData] = useState<any[]>([])
  const [fileName, setFileName] = useState<string>("")
  const [saldoInicialInfo, setSaldoInicialInfo] = useState<{ calculado: number, diferenca: number } | null>(null)
  const [regras, setRegras] = useState<any[]>([])
  const [novasRegras, setNovasRegras] = useState<Set<number>>(new Set()) // Índices das linhas que virarão regra
  const [contas, setContas] = useState<any[]>([])
  const [contaSelecionada, setContaSelecionada] = useState<string>("none")
  
  const contaAtual = contas.find(c => c.id === contaSelecionada)

  useEffect(() => {
    // Carregar regras e contas ao iniciar
    getCategorizationRules().then(data => setRegras(data || []))
    getContasBancarias().then(data => setContas(data || []))
  }, [])

  const aplicarRegras = (descricao: string) => {
    // Busca a primeira regra que bate com a descrição (case insensitive)
    const regra = regras.find(r => descricao.toLowerCase().includes(r.texto_contem.toLowerCase()))
    return regra ? regra.categoria_destino : "Outros"
  }

  const calcularPreviaSaldo = (val: string) => {
    const saldoInformado = parseFloat(val.replace(/\./g, '').replace(',', '.'))
    if (isNaN(saldoInformado)) {
        setSaldoInicialInfo(null)
        return
    }

    const payload = data.map(({ id, ...rest }) => rest)
    const totalEntradas = payload.filter(t => t.tipo === 'Entrada').reduce((acc, t) => acc + t.valor, 0)
    const totalSaidas = payload.filter(t => t.tipo === 'Saída').reduce((acc, t) => acc + t.valor, 0)
    const resultadoCSV = totalEntradas - totalSaidas
    
    // Se eu tenho 210 hoje, e o CSV diz que lucrei 189, então eu comecei com 21.
    const diferenca = saldoInformado - resultadoCSV
    setSaldoInicialInfo({ calculado: saldoInformado, diferenca })
  }
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
        const normalized = results.data.map((row: any, index) => {
          const desc = row['descricao'] || row['Descrição'] || row['description'] || "Sem descrição"
          return {
            id: index,
            data: parseDate(row['data'] || row['Data'] || row['date']),
            descricao: desc,
            valor: parseMoney(row['valor'] || row['Valor'] || row['value'] || "0"),
            categoria: aplicarRegras(desc),
            responsavel: "Casal",
            tipo: parseMoney(row['valor'] || row['Valor'] || row['value'] || "0") < 0 ? "Saída" : "Entrada"
          }
        })
        
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
    const payload = data.map(({ id, ...rest }) => ({
        ...rest,
        conta_id: contaSelecionada !== "none" ? contaSelecionada : null
    }))
    
    // Adicionar transação de Saldo Inicial se o usuário informou um valor
    const saldoInicial = (document.getElementById('saldo-inicial') as HTMLInputElement)?.value
    if (saldoInicial) {
        const saldoAtual = parseFloat(saldoInicial.replace(/\./g, '').replace(',', '.'))
        
        // Calcular quanto foi o movimento do CSV
        const totalEntradas = payload.filter(t => t.tipo === 'Entrada').reduce((acc, t) => acc + t.valor, 0)
        const totalSaidas = payload.filter(t => t.tipo === 'Saída').reduce((acc, t) => acc + t.valor, 0)
        const resultadoCSV = totalEntradas - totalSaidas
        
        // Saldo Inicial Real = Saldo Hoje (informado) - Resultado do CSV
        // Ex: Hoje tenho 210. CSV deu +189. Então comecei com 21.
        const saldoAnterior = saldoAtual - resultadoCSV
        
        // Adicionar transação de ajuste no dia anterior ao início do CSV
        if (Math.abs(saldoAnterior) > 0.01) { // Evita criar ajuste por erro de centavos de ponto flutuante
            // Pegar a data mais antiga do CSV e subtrair 1 dia
            const datas = payload.map(t => new Date(t.data).getTime())
            const primeiraData = new Date(Math.min(...datas))
            primeiraData.setDate(primeiraData.getDate() - 1)
            
            payload.push({
                data: primeiraData.toISOString(),
                descricao: "Saldo Inicial Acumulado (Ajuste Automático)",
                valor: Math.abs(saldoAnterior),
                categoria: "Outros", // Ou criar uma categoria "Saldo Inicial"
                responsavel: "Casal",
                tipo: saldoAnterior > 0 ? "Entrada" : "Saída"
            })
        }
    }

    // Salvar novas regras de categorização
    if (novasRegras.size > 0) {
      const promises = Array.from(novasRegras).map(index => {
        const item = data[index]
        // Regra simples: Palavra chave = Categoria
        // Melhoria futura: Permitir usuário editar a "palavra chave"
        return createCategorizationRule(item.descricao, item.categoria)
      })
      await Promise.all(promises)
    }

    const result = await createTransactionsBatch(payload)
    setIsUploading(false)

    if (result.success) {
      const skippedMsg = result.skipped && result.skipped > 0 ? ` (${result.skipped} duplicadas ignoradas)` : ""
      setSuccessMsg(`${result.count} transações importadas com sucesso!${skippedMsg}`)
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
            <div className="flex items-center gap-4">
               <Select value={contaSelecionada} onValueChange={setContaSelecionada}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Vincular a uma conta..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem conta específica</SelectItem>
                    {contas.map(conta => (
                      <SelectItem key={conta.id} value={conta.id}>
                        {conta.nome} ({conta.responsavel})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button variant="ghost" size="sm" onClick={() => { setData([]); setSaldoInicialInfo(null); }} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                  Cancelar
                </Button>
            </div>
          </div>

          <div className="flex flex-col gap-4 bg-muted/30 p-4 rounded-lg border border-border/50">
            {contaAtual ? (
               <div className="flex items-center gap-3 bg-background border border-border p-3 rounded-md mb-2">
                 <div 
                   className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                   style={{ backgroundColor: contaAtual.cor || '#10b981' }}
                 >
                   {contaAtual.nome.substring(0, 2).toUpperCase()}
                 </div>
                 <div className="flex flex-col">
                   <span className="text-sm font-medium text-foreground">Conta de Destino: {contaAtual.nome}</span>
                   <span className="text-xs text-muted-foreground">Responsável: {contaAtual.responsavel}</span>
                 </div>
               </div>
            ) : (
               <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-md mb-2">
                 <AlertCircle className="h-5 w-5 text-yellow-600" />
                 <span className="text-sm text-yellow-700 dark:text-yellow-400">Nenhuma conta bancária selecionada. As transações serão importadas como "Geral".</span>
               </div>
            )}

            <div className="flex flex-col gap-1">
                <label htmlFor="saldo-inicial" className="text-sm font-medium text-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-500" />
                    Ajuste de Saldo Inicial (Opcional, use apenas na primeira importação)
                </label>
                <span className="text-xs text-muted-foreground">
                    Se você já tem um histórico antes deste CSV, digite seu saldo atual do banco. O sistema criará um ajuste automático para que seu Dashboard bata perfeitamente com a realidade de hoje. Se estiver importando meses antigos separadamente, deixe em branco para não duplicar o ajuste.
                </span>
            </div>
                    <div className="relative max-w-[200px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                        <Input 
                            id="saldo-inicial" 
                            placeholder="0,00" 
                            onChange={(e) => {
                                const val = e.target.value
                                const num = parseFloat(val.replace(/\./g, '').replace(',', '.'))
                                if (!isNaN(num)) {
                                    const payload = data.map(({ id, ...rest }) => rest)
                                    const totalEntradas = payload.filter(t => t.tipo === 'Entrada').reduce((acc, t) => acc + t.valor, 0)
                                    const totalSaidas = payload.filter(t => t.tipo === 'Saída').reduce((acc, t) => acc + t.valor, 0)
                                    const resultadoCSV = totalEntradas - totalSaidas
                                    const diferenca = num - resultadoCSV
                                    setSaldoInicialInfo({ calculado: num, diferenca })
                                } else {
                                    setSaldoInicialInfo(null)
                                }
                            }}
                            className="pl-9 bg-background border-primary/20 focus:border-primary" 
                        />
                    </div>
                 </div>
          
          {saldoInicialInfo && (
            <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg text-sm text-blue-600 dark:text-blue-400 flex flex-col gap-2"
            >
                <div className="flex items-center gap-2 font-semibold">
                    <AlertCircle className="h-4 w-4" />
                    <span>Resumo da Conciliação:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 ml-1 text-muted-foreground">
                    <li>Conta de Destino: <strong>{contaAtual ? contaAtual.nome : 'Geral'}</strong></li>
                    <li>Movimento deste CSV: <strong>{((data.filter(t => t.tipo === 'Entrada').reduce((acc, t) => acc + t.valor, 0)) - (data.filter(t => t.tipo === 'Saída').reduce((acc, t) => acc + t.valor, 0))).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></li>
                    <li>Saldo Final Informado: <strong>{saldoInicialInfo.calculado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></li>
                    <li className="text-foreground font-medium">
                        O sistema criará um ajuste automático de <u>{Math.abs(saldoInicialInfo.diferenca).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</u> ({saldoInicialInfo.diferenca > 0 ? 'Entrada' : 'Saída'}) na conta {contaAtual ? contaAtual.nome : 'Geral'} para equalizar o saldo anterior.
                    </li>
                </ul>
            </motion.div>
          )}

          <div className="rounded-md border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Salvar Regra?</TableHead>
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
                    <TableCell className="text-center">
                        <Checkbox 
                            checked={novasRegras.has(index)}
                            onCheckedChange={(checked) => {
                                const newSet = new Set(novasRegras)
                                if (checked) newSet.add(index)
                                else newSet.delete(index)
                                setNovasRegras(newSet)
                            }}
                        />
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
