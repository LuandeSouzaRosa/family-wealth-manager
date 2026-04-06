import { StatementParseResult } from "./statement-file-types";
import { parseCsvStatement } from "./parse-csv-statement";
import { parseBbPdfStatement } from "./parse-bb-pdf-statement";

export async function parseStatementFile(file: File): Promise<StatementParseResult> {
  const name = file.name.toLowerCase();
  
  if (name.endsWith('.pdf')) {
    return parseBbPdfStatement(file);
  }
  
  if (name.endsWith('.csv')) {
    return parseCsvStatement(file);
  }

  throw new Error("Formato de arquivo incompatível. Utilize extratos em `.csv` ou PDF textual do Banco do Brasil.");
}
