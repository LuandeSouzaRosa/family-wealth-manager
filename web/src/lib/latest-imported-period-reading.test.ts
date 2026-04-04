import { describe, expect, it } from "vitest"
import { buildLatestImportedPeriodReading, isImportedOrigin } from "./latest-imported-period-reading"

describe("latest-imported-period-reading", () => {
  it("retorna null quando nao existem linhas de importacao no periodo", () => {
    const reading = buildLatestImportedPeriodReading([
      {
        categoria: "Moradia",
        valor: 800,
        tipo: "Saida",
        data: "2026-03-04T00:00:00.000Z",
        origem: "Manual",
        responsavel: "Casal",
      },
    ])

    expect(reading).toBeNull()
  })

  it("deriva leitura util a partir de linhas importadas + periodo consolidado", () => {
    const reading = buildLatestImportedPeriodReading([
      {
        categoria: "Moradia",
        valor: 1200,
        tipo: "Saida",
        data: "2026-03-04T00:00:00.000Z",
        origem: "Importacao",
        status: "Realizado",
        responsavel: "Casal",
      },
      {
        categoria: "Outros",
        descricao: "PIX ENVIADO",
        valor: 420,
        tipo: "Saida",
        data: "2026-03-05T00:00:00.000Z",
        origem: "Importacao",
        status: "Realizado",
        responsavel: "Casal",
      },
      {
        categoria: "Transporte",
        valor: 200,
        tipo: "Saida",
        data: "2026-03-09T00:00:00.000Z",
        origem: "Manual",
        status: "Realizado",
        responsavel: "Casal",
      },
    ])

    expect(reading).not.toBeNull()
    expect(reading?.periodLabel).toBe("03/2026")
    expect(reading?.nextActionHref).toContain("/transacoes?month=3&year=2026")
    expect(reading?.expectedConfidenceImpact.length).toBeGreaterThan(10)
    expect(reading?.strengtheningText.length).toBeGreaterThan(10)
  })

  it("identifica origem de importacao de forma tolerante", () => {
    expect(isImportedOrigin("Importacao")).toBe(true)
    expect(isImportedOrigin("Importação")).toBe(true)
    expect(isImportedOrigin("  importacao csv ")).toBe(true)
    expect(isImportedOrigin("Manual")).toBe(false)
  })
})

