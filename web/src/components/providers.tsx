"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import { FilterProvider } from "@/contexts/filter-context"
import { Toaster } from "@/components/ui/sonner"

export function Providers({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <FilterProvider>
        {children}
        <Toaster />
      </FilterProvider>
    </NextThemesProvider>
  )
}