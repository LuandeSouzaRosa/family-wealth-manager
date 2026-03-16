"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useState } from "react"
import { ShieldCheck } from "lucide-react"

export function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    // Show splash for at least 1.5 seconds to feel premium, 
    // but fade out if loading takes longer
    const timer = setTimeout(() => {
      setIsVisible(false)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="relative">
              <motion.div
                animate={{ 
                  boxShadow: ["0 0 0 0px rgba(16, 185, 129, 0)", "0 0 0 20px rgba(16, 185, 129, 0.1)", "0 0 0 40px rgba(16, 185, 129, 0)"]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center"
              >
                <ShieldCheck className="w-10 h-10 text-primary" />
              </motion.div>
            </div>
            
            <div className="text-center space-y-2">
              <motion.h1 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-2xl font-bold tracking-tight"
              >
                L&L Wealth
              </motion.h1>
              <motion.p 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-sm text-muted-foreground uppercase tracking-widest"
              >
                Family Office
              </motion.p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: 200 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="absolute bottom-20 h-1 bg-primary/20 rounded-full overflow-hidden"
          >
             <motion.div 
               className="h-full bg-primary"
               initial={{ x: "-100%" }}
               animate={{ x: "0%" }}
               transition={{ duration: 1.5, ease: "easeInOut" }}
             />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
