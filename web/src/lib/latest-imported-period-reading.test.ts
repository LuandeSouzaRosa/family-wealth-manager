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
        valor: 280,
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
    ], new Date("2026-03-20T00:00:00.000Z"))

    expect(reading).not.toBeNull()
    expect(reading?.periodLabel).toBe("03/2026")
    expect(reading?.temporalSummary.periodReference).toBe("03/2026")
    expect(reading?.temporalSummary.periodStatus).toBe("ongoing")
    expect(reading?.temporalSummary.periodStatusText).toContain("Periodo em andamento")
    expect(reading?.temporalSummary.lastImportedTransactionDate).toBe("05/03/2026")
    expect(reading?.temporalSummary.recencyHint).toMatch(/Leitura (mais recente disponivel|recente)/)
    expect(reading?.nextActionHref).toContain("/transacoes?month=3&year=2026")
    expect(reading?.expectedConfidenceImpact.length).toBeGreaterThan(10)
    expect(reading?.strengtheningText.length).toBeGreaterThan(10)
    expect(reading?.pendingSummary.status).toBe("active")
    expect(reading?.pendingSummary.text).toContain("Pendencia principal deste periodo")
  })

  it("marca pendencia como reduzida quando houve fortalecimento parcial com limitador ainda ativo", () => {
    const reading = buildLatestImportedPeriodReading([
      {
        categoria: "Moradia",
        valor: 500,
        tipo: "Saida",
        data: "2026-03-04T00:00:00.000Z",
        origem: "Importacao",
        status: "Realizado",
        responsavel: "Luan",
      },
      {
        categoria: "Moradia",
        valor: 1500,
        tipo: "Saida",
        data: "2026-03-05T00:00:00.000Z",
        origem: "Manual",
        status: "Realizado",
        responsavel: "Casal",
      },
    ], new Date("2026-03-20T00:00:00.000Z"))

    expect(reading).not.toBeNull()
    expect(reading?.pendingSummary.status).toBe("reduced")
    expect(reading?.pendingSummary.text).toContain("perdeu forca")
  })

  it("marca pendencia como resolvida quando limitador some apos consolidacao", () => {
    const reading = buildLatestImportedPeriodReading([
      {
        categoria: "Outros",
        descricao: "PIX ENVIADO",
        valor: 280,
        tipo: "Saida",
        data: "2026-03-05T00:00:00.000Z",
        origem: "Importacao",
        status: "Realizado",
        responsavel: "Casal",
      },
      {
        categoria: "Moradia",
        valor: 4000,
        tipo: "Saida",
        data: "2026-03-06T00:00:00.000Z",
        origem: "Manual",
        status: "Realizado",
        responsavel: "Casal",
      },
    ], new Date("2026-03-20T00:00:00.000Z"))

    expect(reading).not.toBeNull()
    expect(reading?.pendingSummary.status).toBe("resolved")
    expect(reading?.pendingSummary.text).toContain("pendencia principal anterior foi destravada")
  })

  it("marca sem pendencia relevante quando leitura ja nasce estavel", () => {
    const reading = buildLatestImportedPeriodReading([
      {
        categoria: "Moradia",
        valor: 1500,
        tipo: "Saida",
        data: "2026-03-05T00:00:00.000Z",
        origem: "Importacao",
        status: "Realizado",
        responsavel: "Casal",
      },
      {
        categoria: "Transporte",
        valor: 350,
        tipo: "Saida",
        data: "2026-03-08T00:00:00.000Z",
        origem: "Importacao",
        status: "Realizado",
        responsavel: "Casal",
      },
    ], new Date("2026-03-20T00:00:00.000Z"))

    expect(reading).not.toBeNull()
    expect(reading?.pendingSummary.status).toBe("no_relevant")
    expect(reading?.pendingSummary.text).toContain("Nao ha pendencia forte")
  })

  it("identifica origem de importacao de forma tolerante", () => {
    expect(isImportedOrigin("Importacao")).toBe(true)
    expect(isImportedOrigin("Importação")).toBe(true)
    expect(isImportedOrigin("  importacao csv ")).toBe(true)
    expect(isImportedOrigin("Manual")).toBe(false)
  })

  it("sinaliza periodo encerrado quando referencia esta em mes posterior", () => {
    const reading = buildLatestImportedPeriodReading(
      [
        {
          categoria: "Moradia",
          valor: 1200,
          tipo: "Saida",
          data: "2026-02-10T00:00:00.000Z",
          origem: "Importacao",
          status: "Realizado",
          responsavel: "Casal",
        },
      ],
      new Date("2026-04-20T00:00:00.000Z")
    )

    expect(reading).not.toBeNull()
    expect(reading?.temporalSummary.periodStatus).toBe("closed")
    expect(reading?.temporalSummary.periodStatusText).toContain("encerrado")
    expect(reading?.temporalSummary.recencyHint).toContain("ultimo periodo importado")
  })
})
