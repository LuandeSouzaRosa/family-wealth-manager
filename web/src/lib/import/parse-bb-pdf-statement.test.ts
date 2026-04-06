import { describe, it, expect } from "vitest";
import { extractTransactionsFromBbPdfLines } from "./parse-bb-pdf-statement";

describe("parse-bb-pdf-statement", () => {
  it("should extract typical debit and credit transactions cleanly", () => {
    const lines = [
      "Extrato de Conta Corrente",
      "SISBB - Sistema de Informações Banco do Brasil",
      "Data Dependência Histórico Documento Valor Saldo",
      "15/02/2026 SALDO ANTERIOR 100,00 (+)",
      "Pix Enviado",
      "16/02/2026 12345 50,00 (-)",
      "LUANA FERNANDES",
      "17/02/2026 76543 Transferencia Recebida 2.050,50 (+)",
      "Compra com Cartão",
      "20/02/2026 99008 19,90 (-)",
      "20/02 14:00 DROGARIA ROSARIO",
      "21/02/2026 12345678 Pagto cartão crédito 1.588,61 (-)",
      "S A L D O 2.030,60 (+)"
    ];

    const result = extractTransactionsFromBbPdfLines(lines);
    expect(result.confidence).toBe("high");
    expect(result.rows).toHaveLength(4);
    
    // PIX
    expect(result.rows[0].data).toBe("16/02/2026");
    expect(result.rows[0].descricao).toBe("Pix Enviado - LUANA FERNANDES");
    expect(result.rows[0].valor).toBe("-50");

    // Transferencia
    expect(result.rows[1].data).toBe("17/02/2026");
    expect(result.rows[1].descricao).toBe("LUANA FERNANDES - Transferencia Recebida - Compra com Cartão"); // Sliding window grabs both adjacent text nodes
    expect(result.rows[1].valor).toBe("2050.5"); 

    // Compra
    expect(result.rows[2].data).toBe("20/02/2026");
    expect(result.rows[2].descricao).toBe("Compra com Cartão - DROGARIA ROSARIO");
    expect(result.rows[2].valor).toBe("-19.9");

    // Pgto cartao
    expect(result.rows[3].data).toBe("21/02/2026");
    expect(result.rows[3].descricao).toBe("Pagto cartão crédito");
    expect(result.rows[3].valor).toBe("-1588.61");

    expect(result.ignoredLinesCount).toEqual(expect.any(Number));
  });

  it("should be extremely conservative and abort if no lines match", () => {
    const lines = [
      "Image PDF scanned with no readable text",
      "Just random noise",
      "0423023 23432",
      "Totally invalid layout"
    ];
    const multiplied = Array(15).fill(lines).flat();
    
    const result = extractTransactionsFromBbPdfLines(multiplied);
    expect(result.rows).toHaveLength(0);
    expect(result.confidence).toBe("low");
  });

  it("should handle multipage headers, footers and noisy interleaving", () => {
    const lines = [
      "Extrato de Conta Corrente", // header page 1
      "01/03/2026 SALDO ANTERIOR 0,00 (+)",
      "Pix Enviado",
      "02/03/2026 111 50,00 (-)",
      "João da Silva",
      "Saldo do dia 50,00 (-)", // footer noise
      "Extrato de Conta Corrente", // header page 2
      "03/03/2026 222 10,00 (+)",
      "S A L D O 40,00 (-)"
    ];

    const result = extractTransactionsFromBbPdfLines(lines);
    expect(result.confidence).toBe("high");
    expect(result.rows).toHaveLength(2);
    
    expect(result.rows[0].descricao).toBe("Pix Enviado - João da Silva");
    expect(result.rows[0].valor).toBe("-50");

    expect(result.rows[1].descricao).toBe("Lançamento sem descrição");
    expect(result.rows[1].valor).toBe("10");
  });

  it("should handle complex multiline descriptions accurately without eating values", () => {
    const lines = [
      "Pagamento de Impostos",
      "05/03/2026 333 444 1.234,56 (-)",
      "DARE SANTA CATARINA - IPVA 2026"
    ];

    const result = extractTransactionsFromBbPdfLines(lines);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].descricao).toBe("Pagamento de Impostos - DARE SANTA CATARINA - IPVA 2026");
    expect(result.rows[0].valor).toBe("-1234.56");
  });
});
