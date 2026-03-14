import { login, signup } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet } from 'lucide-react'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/')
  }

  const resolvedParams = await searchParams
  const message = resolvedParams?.message as string | undefined

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center p-4 overflow-hidden bg-background">
      {/* Premium Decorative Background Elements */}
      <div className="absolute inset-0 w-full h-full bg-grid-black/[0.02] dark:bg-grid-white/[0.02]" />
      <div className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4 w-[500px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

      <Card className="w-full max-w-md z-10 border-border/50 bg-background/60 backdrop-blur-xl shadow-2xl">
        <CardHeader className="space-y-3 pb-6 text-center">
          <div className="mx-auto bg-primary/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-2 shadow-inner border border-primary/20">
            <Wallet className="w-7 h-7 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">Family Wealth</CardTitle>
          <CardDescription className="text-base">
            Bem-vindo de volta. Insira suas credenciais para gerenciar seu patrimônio.
          </CardDescription>
        </CardHeader>
        
        {message && (
          <div className="px-6 pb-2">
            <div className="p-3 text-sm font-medium text-destructive-foreground bg-destructive/15 rounded-md border border-destructive/30 text-center animate-in fade-in slide-in-from-top-2">
              {message}
            </div>
          </div>
        )}

        <CardContent>
          <form className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground/80 font-medium">E-mail</Label>
              <Input 
                id="email" 
                name="email" 
                type="email" 
                placeholder="seu@dominio.com" 
                required 
                data-testid="email-input"
                className="bg-background/50 border-border/50 focus-visible:ring-primary/50 h-11 transition-all"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-foreground/80 font-medium">Senha</Label>
              </div>
              <Input 
                id="password" 
                name="password" 
                type="password"
                placeholder="••••••••" 
                required 
                data-testid="password-input"
                className="bg-background/50 border-border/50 focus-visible:ring-primary/50 h-11 transition-all"
              />
            </div>
            <div className="flex flex-col gap-3 pt-4">
              <Button 
                formAction={login} 
                className="w-full h-11 text-base font-semibold shadow-md transition-all hover:shadow-primary/25"
                type="submit"
                data-testid="btn-login"
              >
                Entrar na Conta
              </Button>
              <Button 
                formAction={signup} 
                variant="outline" 
                className="w-full h-11 text-base bg-transparent border-border/50 hover:bg-muted/50 transition-colors"
                type="submit"
                data-testid="btn-signup"
              >
                Criar Conta
              </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-border/40 py-5 bg-muted/10 rounded-b-xl">
          <p className="text-xs text-muted-foreground/50 font-semibold tracking-widest uppercase">
            Sistema Gerencial v6.0
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
