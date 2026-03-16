"use client"

import { useRef, useState, useEffect } from "react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { Wallet, CreditCard, ShieldCheck } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface WealthCard3DProps {
  saldoAtual: number
  saldoLivre?: number
  saldoComprometido?: number
  responsavel: string
}

export function WealthCard3D({ saldoAtual, saldoLivre, saldoComprometido, responsavel }: WealthCard3DProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  
  // Mouse position
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  // Smooth spring animation for tilt
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [15, -15]), { stiffness: 300, damping: 30 })
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-15, 15]), { stiffness: 300, damping: 30 })
  
  // Glare effect
  const glareX = useTransform(rotateY, [-15, 15], [0, 100])
  const glareY = useTransform(rotateX, [15, -15], [0, 100])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return

    const rect = cardRef.current.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    const xPct = (mouseX / width) - 0.5
    const yPct = (mouseY / height) - 0.5

    x.set(xPct)
    y.set(yPct)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <div style={{ perspective: 1000 }} className="w-full h-full min-h-[220px]">
      <motion.div
        ref={cardRef}
        style={{ 
          rotateX, 
          rotateY,
          transformStyle: "preserve-3d"
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative w-full h-full rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 border border-white/10 shadow-2xl overflow-hidden group cursor-pointer"
      >
        {/* Dynamic Glare Overlay */}
        <motion.div 
            style={{
                background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.15), transparent 60%)`
            }}
            className="absolute inset-0 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        />

        {/* Content Layer (Lifted in 3D space) */}
        <div style={{ transform: "translateZ(30px)" }} className="relative z-20 h-full p-6 flex flex-col justify-between">
            
            {/* Top Row: Chip & Logo */}
            <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1">
                    <div className="w-12 h-9 rounded bg-gradient-to-tr from-yellow-200 to-yellow-500 border border-yellow-600/30 shadow-inner flex items-center justify-center relative overflow-hidden">
                         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/circuit-board.png')] opacity-20 mix-blend-overlay"></div>
                         <div className="w-8 h-6 border border-black/10 rounded-sm grid grid-cols-2">
                            <div className="border-r border-b border-black/10"></div>
                            <div className="border-b border-black/10"></div>
                            <div className="border-r border-black/10"></div>
                            <div></div>
                         </div>
                    </div>
                    <span className="text-[10px] text-neutral-400 font-mono tracking-widest uppercase mt-1">
                        Wealth Card
                    </span>
                </div>
                
                <div className="text-right">
                    <div className="flex items-center justify-end gap-2 text-white/90">
                        <span className="font-bold tracking-tight text-lg italic">L&L</span>
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="text-[10px] text-neutral-500 font-mono uppercase">
                        {responsavel === 'Todos' ? 'Family Office' : responsavel}
                    </div>
                </div>
            </div>

            {/* Middle: Balance */}
            <div className="space-y-1 my-4">
                <span className="text-xs text-neutral-400 font-medium uppercase tracking-widest block mb-1">
                    Patrimônio Líquido Disponível
                </span>
                <div className="text-3xl md:text-4xl font-mono text-white tracking-tight drop-shadow-lg">
                    {formatCurrency(saldoAtual)}
                </div>
            </div>

            {/* Bottom: Details (Meta vs Livre) */}
            <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                <div>
                    <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                        Livre
                    </span>
                    <span className="text-sm font-medium text-emerald-400 font-mono">
                        {saldoLivre ? formatCurrency(saldoLivre) : '-'}
                    </span>
                </div>
                <div className="text-right">
                    <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                        Comprometido
                    </span>
                    <span className="text-sm font-medium text-blue-400 font-mono">
                        {saldoComprometido ? formatCurrency(saldoComprometido) : '-'}
                    </span>
                </div>
            </div>

        </div>

        {/* Background Texture/Pattern */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 pointer-events-none"></div>
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-primary/20 blur-[80px] rounded-full pointer-events-none"></div>

      </motion.div>
    </div>
  )
}
