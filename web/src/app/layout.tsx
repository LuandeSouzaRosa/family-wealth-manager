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
                                <Button variant="ghost" size="icon">
                                    <Menu className="h-6 w-6" />
                                </Button>
                            } />
                            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                                <SheetHeader>
                                    <SheetTitle>L&L Wealth</SheetTitle>
                                </SheetHeader>
                                <nav className="flex flex-col gap-4 mt-8">
                                    <Link href="/" className="text-lg font-medium hover:text-primary">Dashboard</Link>
                                    <Link href="/transacoes" className="text-lg font-medium hover:text-primary">Extrato</Link>
                                    <Link href="/conciliacao" className="text-lg font-medium hover:text-primary">Conciliação</Link>
                                    <Link href="/recorrentes" className="text-lg font-medium hover:text-primary">Recorrentes</Link>
                                    <Link href="/orcamentos" className="text-lg font-medium hover:text-primary">Orçamentos</Link>
                                    <Link href="/patrimonio" className="text-lg font-medium hover:text-primary">Patrimônio</Link>
                                    <Link href="/configuracoes" className="text-lg font-medium hover:text-primary">Família</Link>
                                    <div className="mt-4 pt-4 border-t">
                                        <form action={signout} className="w-full">
                                            <Button variant="ghost" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-100/10">
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
