"use client"

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'

type Responsavel = "Todos" | "Luan" | "Luana" | "Casal"
const RESPONSAVEL_STORAGE_KEY = "fwm_responsavel_filter"
const VALID_RESPONSAVEIS: Responsavel[] = ["Todos", "Luan", "Luana", "Casal"]

function isValidResponsavel(value: string | null): value is Responsavel {
  return !!value && VALID_RESPONSAVEIS.includes(value as Responsavel)
}

interface FilterContextType {
  responsavel: Responsavel
  setResponsavel: (resp: Responsavel) => void
}

const FilterContext = createContext<FilterContextType | undefined>(undefined)

export function FilterProvider({ children }: { children: ReactNode }) {
  // Padrao: "Todos" (mostra tudo misturado)
  const [responsavel, setResponsavel] = useState<Responsavel>("Todos")
  const didHydrateStorage = useRef(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(RESPONSAVEL_STORAGE_KEY)
      if (isValidResponsavel(stored)) {
        setResponsavel(stored)
      }
    } finally {
      didHydrateStorage.current = true
    }
  }, [])

  useEffect(() => {
    if (!didHydrateStorage.current) return
    window.localStorage.setItem(RESPONSAVEL_STORAGE_KEY, responsavel)
  }, [responsavel])

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
