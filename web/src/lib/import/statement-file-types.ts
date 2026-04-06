export type StatementParseConfidence = "high" | "low";

export type ParsedStatementRow = {
  data: string;
  descricao: string;
  valor: string;
};

export type StatementParseResult = {
  sourceType: "csv" | "pdf_bb" | "unknown";
  institution: "unknown" | "Banco do Brasil";
  confidence: StatementParseConfidence;
  warnings: string[];
  rows: ParsedStatementRow[];
  rawRowsCount: number;
  parsedRowsCount: number;
  ignoredLinesCount: number;
};
