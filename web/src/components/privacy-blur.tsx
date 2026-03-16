"use client"

import { useEffect, useState } from "react"
import { EyeOff } from "lucide-react"

export function PrivacyBlur() {
  const [isBlurred, setIsBlurred] = useState(false)

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsBlurred(true)
        document.title = "L&L Wealth (Protegido)"
      } else {
        setIsBlurred(false)
        document.title = "Family Wealth Manager"
      }
    }

    const handleBlur = () => {
        setIsBlurred(true)
    }

    const handleFocus = () => {
        setIsBlurred(false)
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("blur", handleBlur)
    window.addEventListener("focus", handleFocus)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("blur", handleBlur)
      window.removeEventListener("focus", handleFocus)
    }
  }, [])

  if (!isBlurred) return null

  return (
    <div className="fixed inset-0 z-[9999] backdrop-blur-xl bg-background/50 flex flex-col items-center justify-center transition-all duration-300">
      <div className="bg-background/80 p-6 rounded-full border border-border shadow-2xl animate-pulse">
        <EyeOff className="w-12 h-12 text-primary" />
      </div>
      <p className="mt-4 text-sm font-medium text-muted-foreground uppercase tracking-widest">
        Modo de Privacidade Ativo
      </p>
    </div>
  )
}
