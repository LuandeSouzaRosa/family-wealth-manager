import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { ModeToggle } from '@/components/theme-toggle'
import { createClient } from '@/utils/supabase/server'
import { Button } from '@/components/ui/button'
import { AmbientBackground } from '@/components/ambient-background'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet"
import { signout } from '@/app/login/actions'
import { ResponsavelSelector } from '@/components/responsavel-selector'

import { MobileNav } from '@/components/mobile-nav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Family Wealth Manager',
  description: 'Gestão Financeira Premium',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'L&L Wealth',
  },
}

export const viewport = {
    themeColor: '#10b981',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Verificando usuário na sessão para exibir o menu
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex flex-col min-h-screen relative z-0">
            <AmbientBackground />
            
            {/* Nav Header Minimalista */}
            {user && (
              <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
                <div className="flex h-16 items-center px-6 max-w-7xl mx-auto w-full">
                  <div className="flex items-center gap-2 mr-8">
                    <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-primary-foreground"></div>
                    </div>
                    <span className="font-semibold tracking-tight text-lg">L&L Wealth</span>
                  </div>
                  
                  {/* Central Navigation (Desktop) */}
                  <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
                    <Link href="/" className="transition-colors hover:text-foreground/80 text-foreground/60">Dashboard</Link>
                    <Link href="/transacoes" className="transition-colors hover:text-foreground/80 text-foreground/60">Extrato</Link>
                    <Link href="/conciliacao" className="transition-colors hover:text-foreground/80 text-foreground/60 flex items-center gap-1">
                        Importar
                    </Link>
                    
                    {/* Menu Planejamento (Dropdown ou Grupo) */}
                    <div className="flex items-center gap-4 border-l border-border/50 pl-4">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest hidden lg:inline-block">Planejamento</span>
                        <Link href="/orcamentos" className="transition-colors hover:text-foreground/80 text-foreground/60 flex items-center gap-1">
                           Orçamentos
                        </Link>
                        <Link href="/recorrentes" className="transition-colors hover:text-foreground/80 text-foreground/60 flex items-center gap-1">
                           Recorrências
                        </Link>
                        <Link href="/metas" className="transition-colors hover:text-foreground/80 text-foreground/60 flex items-center gap-1">
                           Metas
                        </Link>
                    </div>

                    {/* Menu Riqueza */}
                    <div className="flex items-center gap-4 border-l border-border/50 pl-4">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest hidden lg:inline-block">Riqueza</span>
                        <Link href="/investimentos" className="transition-colors hover:text-foreground/80 text-foreground/60">Investimentos</Link>
                        <Link href="/contas" className="transition-colors hover:text-foreground/80 text-foreground/60">Bancos</Link>
                    </div>
                  </nav>

                  <div className="ml-auto flex items-center space-x-4">
                    <ResponsavelSelector />
                    <ModeToggle />
                    
                    {/* Mobile Menu - Moved to Bottom Nav */}

                    <form action={signout} className="hidden md:block">
                      <Button variant="ghost" className="rounded-full text-sm font-medium px-6 hover:bg-secondary">
                        Sair da Conta
                      </Button>
                    </form>
                  </div>
                </div>
              </header>
            )}
            
            <main className="flex-1 max-w-7xl mx-auto w-full pb-20 md:pb-0">
              {children}
            </main>
            
            {user && <MobileNav />}
          </div>
        </Providers>
      </body>
    </html>
  )
}
