"use client"

import { Smartphone } from "lucide-react"
import { useEffect, useState } from "react"

export function LandscapeBlocker() {
  const [isWrongOrientation, setIsWrongOrientation] = useState(false)

  useEffect(() => {
    const checkOrientation = () => {
      // Verifica se é paisagem E se é um dispositivo móvel (altura pequena)
      const isLandscape = window.matchMedia("(orientation: landscape)").matches
      const isMobileHeight = window.matchMedia("(max-height: 600px)").matches
      const isMobileWidth = window.matchMedia("(max-width: 950px)").matches
      
      setIsWrongOrientation(isLandscape && isMobileHeight && isMobileWidth)
    }

    // Checar ao carregar
    checkOrientation()

    // Ouvir mudanças
    window.addEventListener("resize", checkOrientation)
    return () => window.removeEventListener("resize", checkOrientation)
  }, [])

  if (!isWrongOrientation) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
      <div className="bg-primary/10 p-6 rounded-full mb-6 animate-pulse">
        <Smartphone className="w-12 h-12 text-primary rotate-90" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Melhor em Modo Retrato</h2>
      <p className="text-muted-foreground max-w-xs">
        Para uma melhor experiência de gestão financeira, por favor, gire seu dispositivo de volta para a vertical.
      </p>
    </div>
  )
}
