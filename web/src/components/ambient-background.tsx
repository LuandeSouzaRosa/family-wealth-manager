'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function AmbientBackground() {
  const [mounted, setMounted] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    setMounted(true)
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: e.clientX,
        y: e.clientY,
      })
    }
    
    if (typeof window !== 'undefined') {
        window.addEventListener('mousemove', handleMouseMove)
    }
    return () => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('mousemove', handleMouseMove)
        }
    }
  }, [])

  if (!mounted) {
    return <div className="fixed inset-0 z-[-1] bg-background pointer-events-none" />
  }

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-background pointer-events-none">
      {/* Deep noise texture for premium tactility */}
      <div 
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay z-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
      
      {/* Sub-surface Emerald Glows */}
      <motion.div
        className="absolute left-[20%] top-[40%] h-[30vw] w-[30vw] rounded-full bg-primary/10 blur-[100px]"
        animate={{
          x: [0, 50, -20, 0],
          y: [0, -30, 40, 0],
          scale: [1, 1.1, 0.9, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear"
        }}
      />
      
      <motion.div
        className="absolute right-[10%] bottom-[10%] h-[40vw] w-[40vw] rounded-full bg-blue-500/5 blur-[120px]"
        animate={{
          x: [0, -40, 30, 0],
          y: [0, 50, -20, 0],
          scale: [1, 0.8, 1.1, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "linear"
        }}
      />

      {/* Mouse Follower Glow (Interactive Layer) */}
      <motion.div
        className="absolute h-[600px] w-[600px] rounded-full bg-primary/5 blur-[100px] -translate-x-1/2 -translate-y-1/2"
        animate={{
          x: mousePosition.x,
          y: mousePosition.y,
        }}
        transition={{
          type: "spring",
          damping: 50,
          stiffness: 200,
          mass: 0.5
        }}
      />
    </div>
  )
}
