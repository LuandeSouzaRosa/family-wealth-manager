"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Wallet, ArrowRight, Lock, Mail } from 'lucide-react'
import { TiltCard } from "@/components/ui/tilt-card"
import { cn } from "@/lib/utils"

interface LoginClientProps {
  loginAction: (formData: FormData) => Promise<void>
  signupAction: (formData: FormData) => Promise<void>
  message?: string
}

export function LoginClient({ loginAction, signupAction, message }: LoginClientProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login')

  const handleSubmit = async (formData: FormData, action: typeof loginAction | typeof signupAction) => {
    setIsLoading(true)
    try {
      await action(formData)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-background">
      {/* Lado Esquerdo - Visual e Marketing (Desktop Only) */}
      <div className="hidden lg:flex w-1/2 relative flex-col justify-between p-12 bg-black overflow-hidden">
        {/* Animated Background Mesh */}
        <div className="absolute inset-0 z-0 opacity-40">
            <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-primary/30 rounded-full blur-[150px] animate-pulse duration-[10s]" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-blue-600/20 rounded-full blur-[150px] animate-pulse duration-[12s] delay-1000" />
        </div>

        <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
                <div className="bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/10">
                    <Wallet className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-white tracking-tight">Family Wealth</span>
            </div>
        </div>

        <div className="relative z-10 max-w-lg">
            <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-5xl font-bold text-white mb-6 leading-tight"
            >
                Gerencie o futuro financeiro da sua família.
            </motion.h1>
            <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-lg text-white/60 mb-8"
            >
                Tenha controle total sobre orçamentos, investimentos e metas em uma única plataforma segura e intuitiva.
            </motion.p>
            
            {/* Mock Stats Card */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9, rotate: -5 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: 0.5, type: "spring" }}
            >
                <TiltCard className="bg-white/5 border border-white/10 backdrop-blur-xl p-6 max-w-sm">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <p className="text-xs text-white/50 uppercase tracking-wider">Patrimônio Total</p>
                            <p className="text-2xl font-bold text-white">R$ 1.240.500,00</p>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <ArrowRight className="w-4 h-4 text-emerald-400 -rotate-45" />
                        </div>
                    </div>
                    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary to-blue-500 w-[75%]" />
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-white/40">
                        <span>Crescimento Anual</span>
                        <span className="text-emerald-400">+12.5%</span>
                    </div>
                </TiltCard>
            </motion.div>
        </div>

        <div className="relative z-10 text-xs text-white/30">
            © 2026 Family Wealth Manager. Todos os direitos reservados.
        </div>
      </div>

      {/* Lado Direito - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative">
        {/* Mobile Background Elements */}
        <div className="lg:hidden absolute inset-0 z-0 bg-background">
            <div className="absolute top-[-20%] right-[-20%] w-[300px] h-[300px] bg-primary/20 blur-[100px]" />
            <div className="absolute bottom-[-20%] left-[-20%] w-[300px] h-[300px] bg-blue-500/10 blur-[100px]" />
        </div>

        <div className="w-full max-w-[400px] relative z-10">
            <div className="lg:hidden flex justify-center mb-8">
                <div className="bg-primary/10 p-3 rounded-2xl">
                    <Wallet className="w-8 h-8 text-primary" />
                </div>
            </div>

            <div className="mb-8 text-center lg:text-left">
                <h2 className="text-2xl font-bold tracking-tight mb-2">Bem-vindo de volta</h2>
                <p className="text-muted-foreground">
                    Entre com suas credenciais para acessar sua conta.
                </p>
            </div>

            {message && (
                <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center font-medium"
                >
                    {message}
                </motion.div>
            )}

            <div className="space-y-6">
                <form action={async (formData) => {
                    if (activeTab === 'login') {
                        await handleSubmit(formData, loginAction)
                    } else {
                        await handleSubmit(formData, signupAction)
                    }
                }} className="space-y-4">
                    
                    <div className="space-y-2">
                        <Label htmlFor="email">E-mail</Label>
                        <div className="relative group">
                            <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input 
                                id="email" 
                                name="email" 
                                type="email" 
                                placeholder="seu@email.com" 
                                className="pl-10 h-11 bg-background/50 border-input transition-all focus:ring-2 focus:ring-primary/20"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Senha</Label>
                        <div className="relative group">
                            <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input 
                                id="password" 
                                name="password" 
                                type="password" 
                                placeholder="••••••••" 
                                className="pl-10 h-11 bg-background/50 border-input transition-all focus:ring-2 focus:ring-primary/20"
                                required
                            />
                        </div>
                    </div>

                    <Button 
                        type="submit" 
                        className="w-full h-11 text-base font-medium shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Processando...
                            </div>
                        ) : (
                            activeTab === 'login' ? "Acessar Plataforma" : "Criar Nova Conta"
                        )}
                    </Button>
                </form>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                            Ou
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Button 
                        variant={activeTab === 'login' ? "secondary" : "outline"}
                        onClick={() => setActiveTab('login')}
                        className={cn("w-full", activeTab === 'login' && "bg-primary/10 text-primary hover:bg-primary/20")}
                        type="button"
                    >
                        Login
                    </Button>
                    <Button 
                        variant={activeTab === 'signup' ? "secondary" : "outline"}
                        onClick={() => setActiveTab('signup')}
                        className={cn("w-full", activeTab === 'signup' && "bg-primary/10 text-primary hover:bg-primary/20")}
                        type="button"
                    >
                        Cadastro
                    </Button>
                </div>
            </div>
        </div>
      </div>
    </div>
  )
}
