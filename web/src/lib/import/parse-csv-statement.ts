import Papa from "papaparse";
import { ParsedStatementRow, StatementParseResult } from "./statement-file-types";
import { extractCanonicalCsvFields } from "../csv-column-normalization";

export async function parseCsvStatement(contentOrFile: string | File): Promise<StatementParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(contentOrFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          const first = results.errors[0];
          // We don't hard reject, maybe just return 0 rows?
          // If it's a fatal CSV reading error:
          reject(new Error(`CSV parse error (${first.code}): ${first.message}`));
          return;
        }

        const rawRowsCount = results.data.length;
        const rows: ParsedStatementRow[] = [];
        let ignoredLinesCount = 0;

        results.data.forEach((row: any) => {
          const fields = extractCanonicalCsvFields(row || {});
          if (!fields.data && !fields.descricao && !fields.valor) {
            ignoredLinesCount++;
            return;
          }
          rows.push({
            descricao: fields.descricao,
            data: fields.data,
            valor: fields.valor,
          });
        });

        resolve({
          sourceType: "csv",
          institution: "unknown",
          confidence: "high",
          warnings: [],
          rows,
          rawRowsCount,
          parsedRowsCount: rows.length,
          ignoredLinesCount,
        });
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}
