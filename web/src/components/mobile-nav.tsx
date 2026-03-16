"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, CreditCard, Wallet, Target, PieChart, ArrowRightLeft } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

const links = [
  { href: "/", label: "Início", icon: Home },
  { href: "/orcamentos", label: "Orçamentos", icon: PieChart },
  { href: "/contas", label: "Contas", icon: Wallet },
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/metas", label: "Metas", icon: Target },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[90%] sm:max-w-md md:hidden">
      <nav className="flex items-center justify-around rounded-full border border-white/10 bg-black/60 backdrop-blur-xl px-2 py-3 shadow-2xl shadow-black/50 ring-1 ring-white/5">
        {links.map((link) => {
          const isActive = pathname === link.href
          const Icon = link.icon

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 rounded-full p-2 transition-all duration-300",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute inset-0 rounded-full bg-white/10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              
              <motion.div
                whileTap={{ scale: 0.8 }}
                animate={{
                    scale: isActive ? 1.1 : 1,
                    y: isActive ? -2 : 0
                }}
              >
                <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
              </motion.div>
              
              {isActive && (
                <motion.span 
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute -bottom-1 h-1 w-1 rounded-full bg-primary"
                />
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
