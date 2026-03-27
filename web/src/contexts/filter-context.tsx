"use client"

import React, { createContext, useContext, useState, ReactNode } from 'react'

type Responsavel = "Todos" | "Luan" | "Luana" | "Casal"

interface FilterContextType {
  responsavel: Responsavel
  setResponsavel: (resp: Responsavel) => void
}

const FilterContext = createContext<FilterContextType | undefined>(undefined)

export function FilterProvider({ children }: { children: ReactNode }) {
  // Padrão: "Todos" (mostra tudo misturado)
  const [responsavel, setResponsavel] = useState<Responsavel>("Todos")

  return (
    <FilterContext.Provider value={{ responsavel, setResponsavel }}>
      {children}
    </FilterContext.Provider>
  )
}

export function useFilter() {
  const context = useContext(FilterContext)
  if (context === undefined) {
    throw new Error('useFilter must be used within a FilterProvider')
  }
  return context
}