import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
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
} from "@/components/ui/sheet"
import { signout } from '@/app/login/actions'

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
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
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
                    <Link href="/conciliacao" className="transition-colors hover:text-foreground/80 text-foreground/60">Conciliação</Link>
                    <Link href="/recorrentes" className="transition-colors hover:text-foreground/80 text-foreground/60">Recorrentes</Link>
                    <Link href="/orcamentos" className="transition-colors hover:text-foreground/80 text-foreground/60">Orçamentos</Link>
                    <Link href="/patrimonio" className="transition-colors hover:text-foreground/80 text-foreground/60">Patrimônio</Link>
                    <Link href="/configuracoes" className="transition-colors hover:text-foreground/80 text-foreground/60">Família</Link>
                  </nav>

                  <div className="ml-auto flex items-center space-x-4">
                    <ModeToggle />
                    
                    {/* Mobile Menu */}
                    <div className="md:hidden">
                        <Sheet>
                            <SheetTrigger render={
                                <Button variant="ghost" size="icon" className="md:hidden">
                                    <Menu className="h-6 w-6" />
                                </Button>
                            } />
                            <SheetContent side="right" className="w-[85vw] max-w-[350px] border-l border-border/40 bg-background/95 backdrop-blur-xl">
                                <SheetHeader className="text-left border-b border-border/40 pb-4 mb-4">
                                    <SheetTitle className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                                            <div className="h-3 w-3 rounded-full bg-primary-foreground"></div>
                                        </div>
                                        L&L Wealth
                                    </SheetTitle>
                                </SheetHeader>
                                <nav className="flex flex-col gap-2">
                                    <Link href="/" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                                        Dashboard
                                    </Link>
                                    <Link href="/transacoes" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                                        Extrato
                                    </Link>
                                    <Link href="/conciliacao" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                                        Conciliação
                                    </Link>
                                    <Link href="/recorrentes" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                                        Recorrentes
                                    </Link>
                                    <Link href="/orcamentos" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                                        Orçamentos
                                    </Link>
                                    <Link href="/patrimonio" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                                        Patrimônio
                                    </Link>
                                    <Link href="/configuracoes" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                                        Família
                                    </Link>
                                    
                                    <div className="mt-auto pt-8">
                                        <form action={signout} className="w-full">
                                            <Button variant="outline" className="w-full justify-center text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/20">
                                                Sair da Conta
                                            </Button>
                                        </form>
                                    </div>
                                </nav>
                            </SheetContent>
                        </Sheet>
                    </div>

                    <form action={signout} className="hidden md:block">
                      <Button variant="ghost" className="rounded-full text-sm font-medium px-6 hover:bg-secondary">
                        Sair da Conta
                      </Button>
                    </form>
                  </div>
                </div>
              </header>
            )}
            
            <main className="flex-1 max-w-7xl mx-auto w-full">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
