"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Users, Copy, LogOut, ShieldCheck, UserPlus } from "lucide-react"
import { joinFamily, createNewFamily } from "@/actions/family"
import { toast } from "sonner"

interface FamilyClientProps {
  familyData: {
    family: { id: string, name: string } | null
    members: { id: string, email: string, role: string }[]
    currentUserRole: string
  } | null
}

export function FamilyClientShell({ familyData }: FamilyClientProps) {
  const [isPending, startTransition] = useTransition()
  const [inviteCode, setInviteCode] = useState("")

  const copyCode = () => {
    if (familyData?.family?.id) {
      navigator.clipboard.writeText(familyData.family.id)
      alert("Código copiado! Envie para seu cônjuge.")
    }
  }

  const handleJoin = (formData: FormData) => {
    startTransition(async () => {
      const result = await joinFamily(formData)
      if (result.error) {
        alert(result.error)
      } else {
        alert("Você entrou na família com sucesso!")
        window.location.reload() // Força refresh simples
      }
    })
  }

  const handleCreate = () => {
    startTransition(async () => {
        const formData = new FormData()
        formData.append("familyName", "Nova Família")
        await createNewFamily(formData)
        window.location.reload()
    })
  }

  if (!familyData || !familyData.family) {
    return (
        <div className="max-w-2xl mx-auto py-12 px-6">
            <Card>
                <CardHeader>
                    <CardTitle>Configuração de Família</CardTitle>
                    <CardDescription>Você ainda não pertence a nenhuma família.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <form action={handleJoin} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Entrar com Código de Convite</Label>
                            <div className="flex gap-2">
                                <Input name="familyId" placeholder="Cole o UUID da família aqui..." required />
                                <Button type="submit" disabled={isPending}>Entrar</Button>
                            </div>
                        </div>
                    </form>
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Ou</span></div>
                    </div>
                    <Button onClick={handleCreate} variant="outline" className="w-full" disabled={isPending}>
                        Criar Nova Família
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-6 space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-light tracking-tight text-foreground flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          Gestão <span className="font-semibold text-primary">Familiar</span>
        </h1>
        <p className="text-muted-foreground">
          Gerencie quem tem acesso aos dados financeiros compartilhados.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Card de Membros */}
        <Card className="md:col-span-2 border-border bg-card">
          <CardHeader>
            <CardTitle>Membros da Família: {familyData.family.name}</CardTitle>
            <CardDescription>Pessoas com acesso total ao dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {familyData.members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {member.email ? member.email.charAt(0).toUpperCase() : "U"}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{member.email || "Usuário sem email"}</p>
                      <p className="text-xs text-muted-foreground capitalize">{member.role === 'admin' ? 'Administrador' : 'Membro'}</p>
                    </div>
                  </div>
                  {member.role === 'admin' && <ShieldCheck className="h-5 w-5 text-primary/50" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Card de Convite */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5"/> Convidar Cônjuge</CardTitle>
            <CardDescription>Envie este código para quem você quer adicionar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg border border-dashed border-primary/30 flex items-center justify-between">
                <code className="text-xs font-mono text-foreground break-all">
                    {familyData.family.id}
                </code>
                <Button size="icon" variant="ghost" onClick={copyCode} title="Copiar Código">
                    <Copy className="h-4 w-4" />
                </Button>
            </div>
            <p className="text-xs text-muted-foreground">
                A outra pessoa deve acessar esta mesma página e colar o código acima no campo "Entrar em outra família".
            </p>
          </CardContent>
        </Card>

        {/* Card de Ações de Perigo / Troca */}
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Trocar de Família</CardTitle>
            <CardDescription>Entrar em um grupo diferente?</CardDescription>
          </CardHeader>
          <CardContent>
             <form action={handleJoin} className="space-y-4">
                <div className="flex gap-2">
                    <Input name="familyId" placeholder="Código da nova família..." className="bg-background" required />
                    <Button type="submit" variant="destructive" disabled={isPending}>Mudar</Button>
                </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
