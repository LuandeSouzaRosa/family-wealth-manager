"use client"

import { useState } from "react"
import { PluggyConnect } from "react-pluggy-connect"
import { Button } from "@/components/ui/button"
import { createPluggyConnectToken } from "@/actions/pluggy-auth"
import { toast } from "sonner"
import { Building2, Plus, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export function PluggyConnectButton() {
  const [connectToken, setConnectToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const handleStartConnect = async () => {
    setIsLoading(true)
    const result = await createPluggyConnectToken()
    
    if (result.error) {
        toast.error("Erro ao iniciar conexão bancária: " + result.error)
        setIsLoading(false)
        return
    }

    if (result.accessToken) {
        setConnectToken(result.accessToken)
        setIsOpen(true)
    }
    setIsLoading(false)
  }

  const handleSuccess = (itemData: any) => {
    toast.success("Conta conectada com sucesso!")
    setIsOpen(false)
    setConnectToken(null)
    // Aqui poderíamos recarregar a lista de contas
    // window.location.reload()
  }

  const handleError = (error: any) => {
    console.error("Pluggy Error:", error)
    toast.error("Erro na conexão bancária.")
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
            variant="outline" 
            onClick={handleStartConnect} 
            disabled={isLoading}
            className="gap-2"
        >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
            Conectar Banco
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white h-[600px]">
        {connectToken && (
            <PluggyConnect
                connectToken={connectToken}
                includeSandbox={true} // Remover em produção real se não quiser bancos de teste
                onSuccess={handleSuccess}
                onError={handleError}
                onClose={() => setIsOpen(false)}
            />
        )}
      </DialogContent>
    </Dialog>
  )
}
