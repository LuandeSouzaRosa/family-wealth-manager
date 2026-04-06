import { describe, it, expect } from "vitest";
import { parseCsvStatement } from "./parse-csv-statement";
import { parseBbPdfStatement } from "./parse-bb-pdf-statement";
import fs from "fs";

describe("parseCsvStatement Integration", () => {
  it("should parse standard FWM CSV string identically without regressions", async () => {
    const csvContent = `data,descricao,valor\n01/01/2026,Mercado,100.50\n02/01/2026,Salario,5000\n`;
    // Simulando o objeto File provido no browser (alguns parsers exigem polyfills, usaremos File mock ou passaremos string se o parser suportar)
    // O parser foi desenhado com (contentOrFile: string | File)
    const result = await parseCsvStatement(csvContent);
    
    expect(result.sourceType).toBe("csv");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].descricao).toBe("Mercado");
    expect(result.rows[1].valor).toBe("5000");
  });
});
