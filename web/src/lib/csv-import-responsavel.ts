export type CsvImportResponsavel = "Casal" | "Luan" | "Luana"

export type CsvImportPreviewResponsibleRow = {
  responsavel: CsvImportResponsavel
  responsavelAuto?: boolean
}

export function resolveCsvImportResponsavelFromConta(
  contaResponsavel: string | null | undefined
): CsvImportResponsavel {
  const normalized = contaResponsavel?.trim().toLowerCase()

  if (normalized === "luan") return "Luan"
  if (normalized === "luana") return "Luana"
  if (normalized === "casal") return "Casal"
  if (normalized === "todos") return "Casal"

  return "Casal"
}

export function applyCsvImportResponsavelDefault<T extends CsvImportPreviewResponsibleRow>(
  rows: T[],
  responsavelDefault: CsvImportResponsavel
): T[] {
  return rows.map((row) => {
    if (row.responsavelAuto === false) return row
    return { ...row, responsavel: responsavelDefault, responsavelAuto: true }
  })
}

export function markCsvImportResponsavelAsManual<T extends CsvImportPreviewResponsibleRow>(
  row: T,
  responsavel: CsvImportResponsavel
): T {
  return {
    ...row,
    responsavel,
    responsavelAuto: false,
  }
}
