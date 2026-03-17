"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, CreditCard, Wallet, Target, PieChart, ArrowRightLeft } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

const links = [
  { href: "/", label: "Início", icon: Home },
  { href: "/transacoes", label: "Extrato", icon: ArrowRightLeft },
  { href: "/orcamentos", label: "Orçamento", icon: PieChart },
  { href: "/contas", label: "Contas", icon: Wallet },
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/metas", label: "Metas", icon: Target },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md md:hidden">
      <nav className="flex items-center justify-around rounded-2xl border border-white/15 bg-black/75 backdrop-blur-2xl px-1 py-2 shadow-2xl shadow-black/60 ring-1 ring-white/5">
        {links.map((link) => {
          const isActive = pathname === link.href
          const Icon = link.icon

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 transition-all duration-300",
                isActive ? "text-primary" : "text-white/60 hover:text-white/90"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute inset-0 rounded-xl bg-white/10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              
              <motion.div
                whileTap={{ scale: 0.8 }}
                animate={{
                    scale: isActive ? 1.1 : 1,
                    y: isActive ? -1 : 0
                }}
              >
                <Icon className={cn("h-[18px] w-[18px]", isActive && "stroke-[2.5px]")} />
              </motion.div>
              
              <span className={cn(
                "text-[10px] leading-tight",
                isActive ? "font-semibold" : "font-normal opacity-80"
              )}>
                {link.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
