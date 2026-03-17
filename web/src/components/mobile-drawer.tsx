"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  CreditCard,
  Wallet,
  PieChart,
  Repeat,
  Target,
  TrendingUp,
  Landmark,
  Users,
  LogOut,
  Menu,
  ArrowRightLeft,
} from "lucide-react"
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
import { signout } from "@/app/login/actions"
import { ResponsavelSelector } from "@/components/responsavel-selector"

const navSections = [
  {
    label: "Principal",
    items: [
      { href: "/", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/transacoes", icon: ArrowRightLeft, label: "Extrato" },
      { href: "/cartoes", icon: CreditCard, label: "Cartões" },
      { href: "/conciliacao", icon: Wallet, label: "Conciliação" },
    ],
  },
  {
    label: "Planejamento",
    items: [
      { href: "/orcamentos", icon: PieChart, label: "Orçamentos" },
      { href: "/recorrentes", icon: Repeat, label: "Recorrências" },
      { href: "/metas", icon: Target, label: "Metas" },
    ],
  },
  {
    label: "Patrimônio",
    items: [
      { href: "/investimentos", icon: TrendingUp, label: "Investimentos" },
      { href: "/contas", icon: Landmark, label: "Contas Bancárias" },
      { href: "/patrimonio", icon: Wallet, label: "Balanço Patrimonial" },
    ],
  },
  {
    label: "Configurações",
    items: [
      { href: "/categorias", icon: Users, label: "Categorias" },
    ],
  },
]

export function MobileDrawer() {
  const pathname = usePathname()

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu" />
        }
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>

      <SheetContent side="left" className="w-[280px] p-0">
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border/40">
          <SheetTitle className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">L&L Wealth</span>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="px-3 py-1.5 mt-3 mb-1 first:mt-0 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
                {section.label}
              </div>
              {section.items.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <SheetClose key={item.href} render={<div />}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
                      <span className="text-sm">{item.label}</span>
                    </Link>
                  </SheetClose>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-border/40 space-y-3">
          <div className="flex items-center justify-between px-1">
            <ResponsavelSelector />
          </div>

          <form action={signout}>
            <Button
              variant="ghost"
              className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10 gap-2"
            >
              <LogOut className="h-5 w-5" />
              Sair da Conta
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
