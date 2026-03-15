"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"
import { FilterProvider } from "@/contexts/filter-context"
import { Toaster } from "@/components/ui/sonner"

export function Providers({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <FilterProvider>
        {children}
        <Toaster />
      </FilterProvider>
    </NextThemesProvider>
  )
}