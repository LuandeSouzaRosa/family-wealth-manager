"use client"

import { useState } from "react"
import { PluggyConnect } from "react-pluggy-connect"
import { Button } from "@/components/ui/button"
import { createPluggyConnectToken } from "@/actions/pluggy-auth"
import { savePluggyConnection, syncPluggyTransactions } from "@/actions/pluggy-sync"
import { toast } from "sonner"
import { Building2, Loader2, RefreshCw } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"

export function PluggyConnectButton() {
  const [connectToken, setConnectToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const handleStartConnect = async () => {
    setIsLoading(true)
    const origin = typeof window !== 'undefined' ? window.location.origin : undefined
    const result = await createPluggyConnectToken(origin)
    
    if ('error' in result) {
        toast.error("Erro ao iniciar conexão bancária: " + result.error)
        setIsLoading(false)
        return
    }

    if ('accessToken' in result && result.accessToken) {
        setConnectToken(result.accessToken)
        setIsOpen(true)
    }
    setIsLoading(false)
  }

  const handleSuccess = async (itemData: { item: { id: string; connector?: { name?: string } } }) => {
    setIsOpen(false)
    setConnectToken(null)
    setIsSyncing(true)

    const toastId = toast.loading("Conectando banco e importando transações...")

    try {
      const itemId = itemData.item.id
      const connectorName = itemData.item.connector?.name || "Banco"

      // 1. Save the connection to our DB
      const saveResult = await savePluggyConnection(itemId, connectorName)
      if ('error' in saveResult) {
        toast.error("Erro ao salvar conexão: " + saveResult.error, { id: toastId })
        setIsSyncing(false)
        return
      }

      // 2. Sync initial transactions
      const syncResult = await syncPluggyTransactions(itemId)
      if ('error' in syncResult) {
        toast.error("Erro ao importar transações: " + syncResult.error, { id: toastId })
        setIsSyncing(false)
        return
      }

      const inserted = 'inserted' in syncResult ? syncResult.inserted : 0;

      toast.success(
        `${connectorName} conectado! ${inserted} transações importadas.`,
        { id: toastId, duration: 5000 }
      )

      // Reload to refresh data across all components
      window.location.reload()
    } catch (err: any) {
      toast.error("Erro inesperado: " + err.message, { id: toastId })
    } finally {
      setIsSyncing(false)
    }
  }

  const handleError = (error: any) => {
    console.error("Pluggy Error Completo:", error)
    // Extrai mensagem real da Pluggy (pode vir no message ou no response JSON)
    const realMsg = error?.message || error?.response?.message || JSON.stringify(error)
    toast.error(`Falha na API da Pluggy: ${realMsg}`)
    setIsOpen(false)
    setConnectToken(null)
  }

  return (
    <>
      <Button 
          variant="outline" 
          onClick={handleStartConnect} 
          disabled={isLoading || isSyncing}
          className="gap-2"
      >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isSyncing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Building2 className="w-4 h-4" />
          )}
          {isSyncing ? "Importando..." : "Conectar Banco"}
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open)
        if (!open) setConnectToken(null)
      }}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white h-[600px]">
          {connectToken && (
              <PluggyConnect
                  connectToken={connectToken}
                  includeSandbox={process.env.NODE_ENV === "development"}
                  onSuccess={handleSuccess}
                  onError={handleError}
                  onClose={() => {
                    setIsOpen(false)
                    setConnectToken(null)
                  }}
              />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
