import { describe, expect, it } from "vitest"
import {
  applyCsvImportResponsavelDefault,
  markCsvImportResponsavelAsManual,
  resolveCsvImportResponsavelFromConta,
} from "./csv-import-responsavel"

describe("csv-import-responsavel", () => {
  it("resolve responsavel padrao a partir da conta selecionada", () => {
    expect(resolveCsvImportResponsavelFromConta("Luan")).toBe("Luan")
    expect(resolveCsvImportResponsavelFromConta("luana")).toBe("Luana")
    expect(resolveCsvImportResponsavelFromConta("CASAL")).toBe("Casal")
    expect(resolveCsvImportResponsavelFromConta("Todos")).toBe("Casal")
    expect(resolveCsvImportResponsavelFromConta(undefined)).toBe("Casal")
    expect(resolveCsvImportResponsavelFromConta("desconhecido")).toBe("Casal")
  })

  it("aplica responsavel da conta apenas nas linhas ainda automaticas", () => {
    const rows = [
      { id: 1, responsavel: "Casal" as const, responsavelAuto: true },
      { id: 2, responsavel: "Luana" as const, responsavelAuto: false },
      { id: 3, responsavel: "Casal" as const },
    ]

    const updated = applyCsvImportResponsavelDefault(rows, "Luan")

    expect(updated[0]).toMatchObject({ responsavel: "Luan", responsavelAuto: true })
    expect(updated[1]).toMatchObject({ responsavel: "Luana", responsavelAuto: false })
    expect(updated[2]).toMatchObject({ responsavel: "Luan", responsavelAuto: true })
  })

  it("marca linha como manual ao editar responsavel na tabela de preview", () => {
    const manual = markCsvImportResponsavelAsManual(
      { id: 10, responsavel: "Casal" as const, responsavelAuto: true },
      "Luana"
    )

    expect(manual).toMatchObject({ responsavel: "Luana", responsavelAuto: false })
  })
})
