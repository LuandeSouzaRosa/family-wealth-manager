"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, CreditCard, TrendingUp, Menu, Wallet, PieChart } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"

export function MobileNav() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/40 pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        <Link 
          href="/" 
          className={cn(
            "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors",
            isActive("/") ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span className="text-[10px] font-medium">Início</span>
        </Link>

        <Link 
          href="/transacoes" 
          className={cn(
            "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors",
            isActive("/transacoes") ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <CreditCard className="h-5 w-5" />
          <span className="text-[10px] font-medium">Extrato</span>
        </Link>

        <Link 
          href="/investimentos" 
          className={cn(
            "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors",
            isActive("/investimentos") ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <TrendingUp className="h-5 w-5" />
          <span className="text-[10px] font-medium">Investir</span>
        </Link>

        <Link 
          href="/orcamentos" 
          className={cn(
            "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors",
            isActive("/orcamentos") ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <PieChart className="h-5 w-5" />
          <span className="text-[10px] font-medium">Planejar</span>
        </Link>

        <Sheet>
          <SheetTrigger render={
            <button className={cn(
              "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors text-muted-foreground hover:text-foreground"
            )}>
              <Menu className="h-5 w-5" />
              <span className="text-[10px] font-medium">Menu</span>
            </button>
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
            <nav className="flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-10rem)]">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Principal
              </div>
              <SheetClose render={
                <Link href="/" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
              } />
              <SheetClose render={
                <Link href="/transacoes" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                  <CreditCard className="h-4 w-4" />
                  Extrato
                </Link>
              } />
              <SheetClose render={
                <Link href="/cartoes" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                  <CreditCard className="h-4 w-4" />
                  Cartões
                </Link>
              } />
              <SheetClose render={
                <Link href="/conciliacao" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                  <Wallet className="h-4 w-4" />
                  Conciliação
                </Link>
              } />

              <Separator className="my-2 opacity-50" />
              
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Planejamento
              </div>
              <SheetClose render={
                <Link href="/orcamentos" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                  <PieChart className="h-4 w-4" />
                  Orçamentos
                </Link>
              } />
              <SheetClose render={
                <Link href="/recorrentes" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                  <Wallet className="h-4 w-4" />
                  Recorrências
                </Link>
              } />
              <SheetClose render={
                <Link href="/metas" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                  <TrendingUp className="h-4 w-4" />
                  Metas
                </Link>
              } />

              <Separator className="my-2 opacity-50" />

              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Riqueza
              </div>
              <SheetClose render={
                <Link href="/investimentos" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                  <TrendingUp className="h-4 w-4" />
                  Investimentos
                </Link>
              } />
              <SheetClose render={
                <Link href="/contas" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                  <Wallet className="h-4 w-4" />
                  Contas Bancárias
                </Link>
              } />
              <SheetClose render={
                <Link href="/patrimonio" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                  <TrendingUp className="h-4 w-4" />
                  Patrimônio
                </Link>
              } />

              <Separator className="my-2 opacity-50" />

              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Configurações
              </div>
              <SheetClose render={
                <Link href="/configuracoes" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                  <Wallet className="h-4 w-4" />
                  Família
                </Link>
              } />
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
