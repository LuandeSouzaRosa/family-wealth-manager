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
  ChevronRight,
  ChevronLeft
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { signout } from "@/app/login/actions"
import { ModeToggle } from "@/components/theme-toggle"
import { ResponsavelSelector } from "@/components/responsavel-selector"

interface SidebarProps {
  userEmail?: string
}

export function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  // Recuperar estado do localStorage
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed")
    if (stored) setCollapsed(stored === "true")
  }, [])

  const toggleSidebar = () => {
    const newState = !collapsed
    setCollapsed(newState)
    localStorage.setItem("sidebar-collapsed",String(newState))
  }

  const isActive = (path: string) => pathname === path

  const NavItem = ({ href, icon: Icon, label }: { href: string, icon: any, label: string }) => (
    <Link 
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 group relative",
        isActive(href) 
          ? "bg-primary/10 text-primary font-medium" 
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0", isActive(href) && "text-primary")} />
      
      {!collapsed && <span>{label}</span>}
      
      {/* Tooltip for collapsed state */}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
          {label}
        </div>
      )}
    </Link>
  )

  const SectionLabel = ({ label }: { label: string }) => {
    if (collapsed) return <div className="h-px bg-border/50 my-2 mx-2" />
    return (
      <div className="px-3 py-1.5 mt-4 mb-1 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
        {label}
      </div>
    )
  }

  return (
    <aside 
      className={cn(
        "hidden md:flex flex-col border-r border-border/40 bg-background/95 backdrop-blur-xl h-screen sticky top-0 transition-all duration-300 z-40",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Header */}
      <div className="h-16 flex items-center px-4 border-b border-border/40">
        <div className={cn("flex items-center gap-2 overflow-hidden", collapsed && "justify-center w-full")}>
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
            <div className="h-3 w-3 rounded-full bg-primary-foreground"></div>
          </div>
          {!collapsed && <span className="font-semibold tracking-tight text-lg truncate">L&L Wealth</span>}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <NavItem href="/" icon={LayoutDashboard} label="Dashboard" />
        <NavItem href="/transacoes" icon={CreditCard} label="Extrato" />
        <NavItem href="/conciliacao" icon={Wallet} label="Conciliação" />

        <SectionLabel label="Planejamento" />
        <NavItem href="/orcamentos" icon={PieChart} label="Orçamentos" />
        <NavItem href="/recorrentes" icon={Repeat} label="Recorrências" />
        <NavItem href="/metas" icon={Target} label="Metas" />

        <SectionLabel label="Patrimônio" />
        <NavItem href="/investimentos" icon={TrendingUp} label="Investimentos" />
        <NavItem href="/contas" icon={Landmark} label="Contas Bancárias" />
        <NavItem href="/patrimonio" icon={Wallet} label="Balanço Patrimonial" />

        <SectionLabel label="Configurações" />
        <NavItem href="/configuracoes" icon={Users} label="Família & Perfil" />
      </div>

      {/* Footer Actions */}
      <div className="p-3 border-t border-border/40 space-y-2">
        {!collapsed && (
            <div className="flex items-center justify-between px-1 mb-2">
                 <ModeToggle />
                 <ResponsavelSelector />
            </div>
        )}
        
        {collapsed && (
            <div className="flex flex-col gap-2 items-center">
                <ModeToggle />
            </div>
        )}

        <form action={signout}>
          <Button 
            variant="ghost" 
            className={cn(
              "w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10",
              collapsed && "justify-center px-0"
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span className="ml-2">Sair</span>}
          </Button>
        </form>

        <Button 
          variant="ghost" 
          size="sm" 
          onClick={toggleSidebar}
          className="w-full mt-2 text-muted-foreground hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  )
}
