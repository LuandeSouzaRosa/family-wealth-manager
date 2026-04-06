import { describe, it, expect } from "vitest";
import { extractTransactionsFromBbPdfLines } from "./parse-bb-pdf-statement";

describe("parse-bb-pdf-statement", () => {
  it("should extract typical debit and credit transactions cleanly", () => {
    const lines = [
      "Extrato de Conta Corrente",
      "SISBB - Sistema de Informações Banco do Brasil",
      "Data Dependência Histórico Documento Valor Saldo",
      "15/02/2026 SALDO ANTERIOR 100,00 C",
      "16/02/2026 12345 PIX Enviado Luan 1234567 50,00 D 50,00 C",
      "17/02/2026 Transferencia Recebida 76543 2.000,50 C 2.050,50 C",
      "20/02/2026 Compra no debito Drogaria 19,90 D 2.030,60 C",
      "S A L D O 2.030,60 C"
    ];

    const result = extractTransactionsFromBbPdfLines(lines);
    expect(result.confidence).toBe("high");
    expect(result.rows).toHaveLength(3);
    
    // PIX
    expect(result.rows[0].data).toBe("16/02/2026");
    expect(result.rows[0].descricao).toBe("PIX Enviado Luan");
    expect(result.rows[0].valor).toBe("-50"); // D -> neg

    // Transferencia
    expect(result.rows[1].data).toBe("17/02/2026");
    expect(result.rows[1].descricao).toBe("Transferencia Recebida");
    expect(result.rows[1].valor).toBe("2000.5"); // C -> positive

    // Compra
    expect(result.rows[2].data).toBe("20/02/2026");
    expect(result.rows[2].descricao).toBe("Compra no debito Drogaria");
    expect(result.rows[2].valor).toBe("-19.9");

    expect(result.ignoredLinesCount).toBe(5); // 3 titles + 1 S A L D O + 1 SALDO ANTERIOR
  });

  it("should be extremely conservative and abort if no lines match", () => {
    const lines = [
      "Image PDF scanned with no readable text",
      "Just random noise",
      "0423023 23432",
      "Totally invalid layout"
    ];
    // By duplicating enough lines we trigger the rawRowsCount > 10 threshold
    const multiplied = Array(15).fill(lines).flat();
    
    const result = extractTransactionsFromBbPdfLines(multiplied);
    expect(result.rows).toHaveLength(0);
    expect(result.confidence).toBe("low");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("0 transacoes financeiras reconhecidas");
  });
});
