import { describe, expect, it } from "vitest";
import {
  categorizeImportedDescription,
  deriveRuleTextFromDescription,
  type CategorizationRule,
} from "./csv-categorization";

function legacyMatcher(descricao: string, regras: CategorizationRule[]): string {
  const regra = regras.find((r) =>
    descricao.toLowerCase().includes((r.texto_contem || "").toLowerCase())
  );
  return regra ? regra.categoria_destino : "Outros";
}

describe("csv categorization helper", () => {
  it("reaproveita regra PIX por alias do recebedor e evita fallback generico", () => {
    const regras: CategorizationRule[] = [
      {
        texto_contem:
          "Transfer\u00eancia enviada pelo Pix - AMO SISTEMAS LTDA - 23.145.228/0001-75 - ITA\u00da UNIBANCO S.A. (0341) Ag\u00eancia: 327 Conta: 99370-5",
        categoria_destino: "Alimenta\u00e7\u00e3o",
        created_at: "2026-03-19T16:39:16.936187+00:00",
      },
    ];

    const descricaoImportada =
      "Transfer\u00eancia enviada pelo Pix - AMO SISTEMAS LTDA - 23.145.228/0001-75 - BANCO XP S.A. (0348) Ag\u00eancia: 1 Conta: 1935031-9";

    expect(legacyMatcher(descricaoImportada, regras)).toBe("Outros");
    expect(categorizeImportedDescription(descricaoImportada, regras)).toBe("Alimenta\u00e7\u00e3o");
  });

  it("resolve conflitos de regra pelo registro mais recente quando token empata", () => {
    const descricao = "Compra no d\u00e9bito - SUPERMERCADO KLOPPEL";
    const regras: CategorizationRule[] = [
      {
        texto_contem: descricao,
        categoria_destino: "Outros",
        created_at: "2026-03-18T16:39:16.936187+00:00",
      },
      {
        texto_contem: descricao,
        categoria_destino: "Alimenta\u00e7\u00e3o",
        created_at: "2026-03-19T16:39:16.936187+00:00",
      },
    ];

    expect(categorizeImportedDescription(descricao, regras)).toBe("Alimenta\u00e7\u00e3o");
  });

  it("normaliza acentos e caixa para nao perder match valido", () => {
    const regras: CategorizationRule[] = [
      {
        texto_contem: "Compra no d\u00e9bito - SUPERMERCADO KLOPPEL",
        categoria_destino: "Alimenta\u00e7\u00e3o",
      },
    ];

    expect(categorizeImportedDescription("compra no debito - supermercado kloppel", regras)).toBe(
      "Alimenta\u00e7\u00e3o"
    );
  });

  it("retorna Outros quando nenhuma regra corresponde", () => {
    const regras: CategorizationRule[] = [
      {
        texto_contem: "Compra no d\u00e9bito - SUPERMERCADO KLOPPEL",
        categoria_destino: "Alimenta\u00e7\u00e3o",
      },
    ];

    expect(categorizeImportedDescription("Tarifa de manutenção de conta", regras)).toBe("Outros");
  });

  it("gera texto de regra reaproveitavel para PIX e mantem descricao sem padrao", () => {
    expect(
      deriveRuleTextFromDescription(
        "Transfer\u00eancia enviada pelo Pix - AMO SISTEMAS LTDA - 23.145.228/0001-75 - ITA\u00da UNIBANCO S.A. (0341) Ag\u00eancia: 327 Conta: 99370-5"
      )
    ).toBe("AMO SISTEMAS LTDA");

    expect(deriveRuleTextFromDescription("Pagamento de fatura")).toBe("Pagamento de fatura");
  });

  it("aplica heuristica de fatura quando nao existe regra do usuario", () => {
    expect(categorizeImportedDescription("Pagamento de fatura", [])).toBe("Fatura Cartao");
  });

  it("mantem prioridade da regra do usuario sobre heuristica", () => {
    const regras: CategorizationRule[] = [
      {
        texto_contem: "Pagamento de fatura",
        categoria_destino: "Moradia",
        created_at: "2026-03-20T10:00:00.000Z",
      },
    ];
    expect(categorizeImportedDescription("Pagamento de fatura", regras)).toBe("Moradia");
  });

  it("aplica heuristica de investimento para pix com banco xp", () => {
    expect(
      categorizeImportedDescription(
        "Transferência enviada pelo Pix - LUANA FERNANDES - •••.136.329-•• - Banco XP S.A. (0348) Agência: 1 Conta: 1935031-9",
        []
      )
    ).toBe("Investimentos");
  });

  it("aplica heuristica de transporte para boleto de sefaz", () => {
    expect(
      categorizeImportedDescription("Pagamento de boleto efetuado - SEFAZ SANTA CATARINA", [])
    ).toBe("Transporte");
  });
});
