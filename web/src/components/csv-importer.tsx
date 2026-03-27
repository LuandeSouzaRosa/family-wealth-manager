'use client'

import { useState, useEffect, useRef } from 'react'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { processReconciliationBatch } from '@/actions/transactions'
import { getCategorizationRules, createCategorizationRule } from '@/actions/categories'
import { getContasBancarias } from '@/actions/accounts'
import { getReconciliationCandidates } from '@/actions/reconciliation'
import { findBestMatch, parseDate, parseMoney } from '@/lib/reconciliation-logic'
import { Upload, Check, AlertCircle, Loader2, FileSpreadsheet, PlusCircle, Info } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"

const CATEGORIAS = [
  "Alimentação", "Moradia", "Transporte", "Lazer", "Saúde", 
  "Educação", "Salário", "Investimentos", "Outros"
]

const RESPONSAVEIS = ["Casal", "Luan", "Luana"]

export function CsvImporter() {
  const [isUploading, setIsUploading] = useState(false)
  const [data, setData] = useState<any[]>([])
  const [fileName, setFileName] = useState<string>("")
  const [saldoInicialInfo, setSaldoInicialInfo] = useState<{ calculado: number, diferenca: number } | null>(null)
  const [regras, setRegras] = useState<any[]>([])
  const [novasRegras, setNovasRegras] = useState<Set<number>>(new Set()) // Índices das linhas que virarão regra
  const [contas, setContas] = useState<any[]>([])
  const [contaSelecionada, setContaSelecionada] = useState<string>("none")
  const isSubmittingRef = useRef(false)
  
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
             complete: async (results) => {
          let lastValidDate = new Date().toISOString();
          const normalized = results.data.map((row: any, index) => {
            const desc = row['descricao'] || row['Descrição'] || row['description'] || "Sem descrição"
            const rawDate = row['data'] || row['Data'] || row['date']
            const safeDate = parseDate(rawDate, lastValidDate)
            lastValidDate = safeDate;

            return {
              id: index,
              data: safeDate,
              descricao: desc,
              valor: parseMoney(row['valor'] || row['Valor'] || row['value'] || "0"),
              categoria: aplicarRegras(desc),
              responsavel: "Casal",
              tipo: (parseMoney(row['valor'] || row['Valor'] || row['value'] || "0") < 0 ? "Saída" : "Entrada") as "Entrada" | "Saída"
            }
          })
          
          const cleanData = normalized.map(item => {
             let val = item.valor
             let tipo = item.tipo
             if (val < 0) {
               val = Math.abs(val)
               tipo = "Saída"
             }
             return { ...item, valor: val, tipo: tipo as "Entrada" | "Saída" }
          }).filter(item => item.valor > 0); // Ignore rows with 0 values

          if (cleanData.length > 0) {
              const datas = cleanData.map(t => new Date(t.data).getTime());
              const minStr = new Date(Math.min(...datas)).toISOString();
              const maxStr = new Date(Math.max(...datas)).toISOString();

              const candidates = await getReconciliationCandidates(minStr, maxStr);

              // Hardening: Bloqueio contra Duplicate Claiming 
              const usedCandidates = new Set<string>();

              const reconciledData = cleanData.map(row => {
                  const availableCandidates = candidates.filter(c => {
                      const id = c.is_split_group ? c.split_group_id! : c.id;
                      return !usedCandidates.has(id);
                  });

                  const match = findBestMatch(row, availableCandidates);
                  let acao: "Novo" | "Conciliar" | "Duplicado" = "Novo";
                  
                  if (match.level === "Exato") {
                     acao = "Duplicado"; 
                     if (match.candidateId) usedCandidates.add(match.candidateId);
                  }
                  else if (match.level === "Forte") {
                     acao = "Conciliar"; 
                     if (match.candidateId) usedCandidates.add(match.candidateId);
                  }
                  
                  return {
                      ...row,
                      acao,
                      matchLevel: match.level,
                      matchCandidateId: match.candidateId,
                      isSplitGroup: match.isSplitGroup,
                      matchScore: match.score,
                      matchReasons: match.reasons
                  };
              });
              setData(reconciledData);
          } else {
              setData([]);
          }
        },
        error: (error) => {
        console.error(error)
        toast.error("Erro ao ler CSV: " + error.message)
      }
    })
  }

  const updateRow = (index: number, field: string, value: any) => {
    const newData = [...data]
    newData[index] = { ...newData[index], [field]: value }
    setData(newData)
  }

  const handleImport = async () => {
    if (isSubmittingRef.current) return; // True synchronous lock via ref
    isSubmittingRef.current = true;
    setIsUploading(true)
    const valids = data.filter(r => r.acao !== "Duplicado")
    
    const payload = valids.map(({ id, acao, matchLevel, matchCandidateId, isSplitGroup, matchScore, ...rest }) => ({
        ...rest,
        conta_id: contaSelecionada !== "none" ? contaSelecionada : null,
        _acao: acao,
        _matchCandidateId: matchCandidateId,
        _isSplitGroup: isSplitGroup
    }))
    
    const inserts = payload.filter(p => p._acao === "Novo" || !p._matchCandidateId).map(({_acao, _matchCandidateId, _isSplitGroup, ...t}) => t);
    
    // Adicionar transação de Saldo Inicial se o usuário informou um valor (somente nos INSERTS)
    const saldoInicial = (document.getElementById('saldo-inicial') as HTMLInputElement)?.value
    if (saldoInicial) {
        const saldoAtual = parseFloat(saldoInicial.replace(/\./g, '').replace(',', '.'))
        
        // O Saldo Inicial deve abater também as conciliações, pois pertencem ao escopo do extrato!
        const totalEntradas = valids.filter(t => t.tipo === 'Entrada').reduce((acc, t) => acc + t.valor, 0)
        const totalSaidas = valids.filter(t => t.tipo === 'Saída').reduce((acc, t) => acc + t.valor, 0)
        const resultadoCSV = totalEntradas - totalSaidas
        
        const saldoAnterior = saldoAtual - resultadoCSV
        
        if (Math.abs(saldoAnterior) > 0.01) { 
            const datas = valids.map(t => new Date(t.data).getTime())
            const primeiraData = datas.length > 0 ? new Date(Math.min(...datas)) : new Date()
            primeiraData.setDate(primeiraData.getDate() - 1)
            
            inserts.push({
                data: primeiraData.toISOString(),
                descricao: "Ajuste de saldo inicial",
                valor: Math.abs(saldoAnterior),
                categoria: "Outros", 
                responsavel: "Casal",
                tipo: saldoAnterior > 0 ? "Entrada" : "Saída",
                conta_id: contaSelecionada !== "none" ? contaSelecionada : null
            })
        }
    }

    // Salvar novas regras de categorização
    if (novasRegras.size > 0) {
      const promises = Array.from(novasRegras).map(index => {
        const item = data[index]
        return createCategorizationRule(item.descricao, item.categoria)
      })
      await Promise.all(promises)
    }

    const conciliations = payload.filter(p => p._acao === "Conciliar" && p._matchCandidateId).map(p => ({
        candidateId: p._matchCandidateId,
        conta_id: p.conta_id,
        isSplitGroup: p._isSplitGroup
    }));

    try {
      const result = await processReconciliationBatch({ inserts, conciliations })
      setIsUploading(false)

      if (result && 'count' in result) {
        const concMsg = result.conciliated && result.conciliated > 0 ? ` e ${result.conciliated} conciliações realizadas` : ""
        setSuccessMsg(`${result.count} novas importadas${concMsg} com sucesso!`)
        toast.success("Importação concluída com sucesso!")
        setData([])
        setFileName("")
      } else if (result && 'error' in result) {
        toast.error("Erro na importação: " + result.error)
      }
    } finally {
      isSubmittingRef.current = false;
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-muted-foreground overflow-hidden">
              <FileSpreadsheet className="h-5 w-5 shrink-0" />
              <span className="font-medium text-foreground truncate">{fileName}</span>
              <span className="text-sm shrink-0">({data.length} linhas)</span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
               <Select value={contaSelecionada} onValueChange={setContaSelecionada}>
                  <SelectTrigger className="w-full sm:w-[250px]">
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

                <Button variant="ghost" size="sm" onClick={() => { setData([]); setSaldoInicialInfo(null); }} className="w-full sm:w-auto text-destructive hover:text-destructive hover:bg-destructive/10">
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
                </ul>
                {Math.abs(saldoInicialInfo.diferenca) > 0.01 && (
                    <div className="mt-2 p-3 bg-background/50 rounded-md border border-blue-500/10 text-foreground">
                        <p className="font-medium text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-2 text-sm">
                            <Info className="h-4 w-4" /> Ajuste de saldo
                        </p>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                            Para que os valores fechem exatamente com o saldo informado, será criado um lançamento automático de <strong>{Math.abs(saldoInicialInfo.diferenca).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong> antes da primeira transação deste arquivo.
                        </p>
                    </div>
                )}
            </motion.div>
          )}

          {/* Dica CSV-First */}
          <div className="bg-muted/30 p-4 rounded-lg border border-border/50 mb-4 flex items-start gap-3">
             <div className="mt-0.5 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
               <Info className="w-4 h-4 text-primary" />
             </div>
             <div className="text-sm">
               <p className="font-medium text-foreground">Dica de Revisão Rápida</p>
               <p className="text-muted-foreground mt-1">
                 Ao alterar a Categoria de uma linha, a opção <strong>"Salvar Regra"</strong> é marcada automaticamente. 
                 Isso ensina o sistema a automatizar o preenchimento para compras com este mesmo nome no futuro. 
                 Você pode excluir ou revisar essas memorizações a qualquer momento no menu <Link href="/categorias" className="text-primary hover:underline font-medium">Categorias</Link>.
               </p>
             </div>
          </div>

          <div className="rounded-md border bg-card overflow-hidden overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Status / Ação</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição do Banco</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>
                    <div className="flex flex-col">
                       <span>Salvar Regra?</span>
                       <span className="text-[10px] text-muted-foreground font-normal">(Aprender)</span>
                    </div>
                  </TableHead>
                  <TableHead>Responsável</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, index) => (
                  <TableRow key={index} className={row.acao === "Duplicado" ? "opacity-50" : ""}>
                    <TableCell>
                       <Select value={row.acao} onValueChange={(val) => updateRow(index, 'acao', val)}>
                        <SelectTrigger className={cn(
                          "h-8 w-[160px] text-xs font-semibold border",
                          row.acao === "Conciliar" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" : 
                          row.acao === "Novo" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : 
                          "bg-muted text-muted-foreground border-border"
                        )}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Novo">Importar Novo</SelectItem>
                          <SelectItem value="Conciliar">
                             {row.matchLevel === "Exato" || row.matchLevel === "Forte" || row.matchLevel === "Possível" 
                                ? `Conciliar (${row.matchLevel})` 
                                : "Conciliar (Forçar)"}
                          </SelectItem>
                          <SelectItem value="Duplicado">Ignorar</SelectItem>
                        </SelectContent>
                      </Select>
                      {row.acao === "Conciliar" && (
                          <div className="mt-1 flex flex-col gap-0.5">
                             {row.matchReasons?.length > 0 && (
                                 <span className="text-[9px] text-muted-foreground leading-tight">
                                   Motivo: {row.matchReasons.join(" • ")}
                                 </span>
                             )}
                             {row.isSplitGroup && (
                                 <span className="text-[10px] text-blue-500 font-medium">✨ Match: Grupo Split</span>
                             )}
                          </div>
                      )}
                      {row.acao === "Novo" && row.matchLevel === "Possível" && (
                          <div className="mt-1 text-[10px] text-amber-600 font-medium flex items-center gap-1 leading-tight">
                            <AlertCircle className="w-3 h-3" /> Match possível não selecionado. Revisão recomendada.
                          </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{row.data}</TableCell>
                    <TableCell className="font-medium text-xs">{row.descricao}</TableCell>
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
                      <Select value={row.categoria} onValueChange={(val) => {
                          updateRow(index, 'categoria', val)
                          const newRules = new Set(novasRegras)
                          newRules.add(index)
                          setNovasRegras(newRules)
                      }}>
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
