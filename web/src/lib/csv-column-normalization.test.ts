import { describe, expect, it } from "vitest";
import { extractCanonicalCsvFields } from "./csv-column-normalization";

describe("csv header normalization", () => {
  it("aceita variacoes plausiveis de descricao sem perder mapeamento", () => {
    const row = {
      Descricao: "Supermercado do bairro",
      Data: "2026-04-02",
      Valor: "-120.55",
    };

    expect(extractCanonicalCsvFields(row)).toEqual({
      descricao: "Supermercado do bairro",
      data: "2026-04-02",
      valor: "-120.55",
    });
  });

  it("aceita header com acento e caixa alta", () => {
    const row = {
      ["DESCRI\u00c7\u00c3O"]: "Pagamento de fatura",
      DATE: "2026-04-10",
      AMOUNT: "-950.00",
    };

    expect(extractCanonicalCsvFields(row)).toEqual({
      descricao: "Pagamento de fatura",
      data: "2026-04-10",
      valor: "-950.00",
    });
  });

  it("retorna vazio quando o campo nao existe no header", () => {
    const row = {
      historico_extra: "Sem mapeamento",
      amount_extra: "-10",
    };

    expect(extractCanonicalCsvFields(row)).toEqual({
      descricao: "",
      data: "",
      valor: "",
    });
  });
});
