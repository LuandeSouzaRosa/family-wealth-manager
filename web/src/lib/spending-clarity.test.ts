import { describe, expect, it } from "vitest";
import { buildSpendingClaritySnapshot, type SpendingClarityInput } from "./spending-clarity";

const currentMonth: SpendingClarityInput[] = [
  { tipo: "Sa\u00EDda", valor: 300, categoria: "Alimentacao", responsavel: "Casal", status: "Realizado" },
  { tipo: "Sa\u00EDda", valor: 120, categoria: "Transporte", responsavel: "Casal", status: "Realizado" },
  { tipo: "Sa\u00EDda", valor: 100, categoria: "Transporte", responsavel: "Casal", status: "Realizado" },
  { tipo: "Sa\u00EDda", valor: 80, categoria: "Transporte", responsavel: "Casal", status: "Realizado" },
  { tipo: "Sa\u00EDda", valor: 200, categoria: "Assinaturas", responsavel: "Luan", status: "Realizado" },
  { tipo: "Sa\u00EDda", valor: 50, categoria: "Lazer", responsavel: "Luana", status: "Pendente" },
  { tipo: "Entrada", valor: 900, categoria: "Salario", responsavel: "Luan", status: "Realizado" },
];

const previousMonth: SpendingClarityInput[] = [
  { tipo: "Sa\u00EDda", valor: 180, categoria: "Alimentacao", responsavel: "Casal", status: "Realizado" },
  { tipo: "Sa\u00EDda", valor: 250, categoria: "Transporte", responsavel: "Casal", status: "Realizado" },
  { tipo: "Sa\u00EDda", valor: 120, categoria: "Assinaturas", responsavel: "Luan", status: "Realizado" },
];

describe("buildSpendingClaritySnapshot", () => {
  it("mantem ranking de categorias e concentracao coerentes no filtro Todos", () => {
    const snapshot = buildSpendingClaritySnapshot(currentMonth, previousMonth);

    expect(snapshot.Todos.totalSaidasRealizadas).toBe(800);
    expect(snapshot.Todos.topCategorias[0].total).toBe(300);
    expect(snapshot.Todos.topCategorias[1].total).toBe(300);
    expect(snapshot.Todos.topCategorias.map((item) => item.categoria)).toEqual(
      expect.arrayContaining(["Alimentacao", "Transporte"])
    );
    expect(snapshot.Todos.concentracaoTop3Percentual).toBe(100);
  });

  it("respeita filtro Casal sem vazar despesas de Luan ou Luana", () => {
    const snapshot = buildSpendingClaritySnapshot(currentMonth, previousMonth);

    expect(snapshot.Casal.totalSaidasRealizadas).toBe(600);
    expect(snapshot.Casal.topCategorias.map((c) => c.categoria)).toEqual(["Alimentacao", "Transporte"]);
    expect(snapshot.Casal.topCategorias.find((c) => c.categoria === "Assinaturas")).toBeUndefined();
  });

  it("identifica maior alta vs mes anterior e separa recorrente de pontual", () => {
    const snapshot = buildSpendingClaritySnapshot(currentMonth, previousMonth);

    expect(snapshot.Casal.maiorAltaVsMesAnterior).toEqual({
      categoria: "Alimentacao",
      delta: 120,
      atual: 300,
      anterior: 180,
    });
    expect(snapshot.Casal.totalRecorrente).toBe(300);
    expect(snapshot.Casal.totalPontual).toBe(300);
  });

  it("retorna estrutura vazia quando nao ha saidas realizadas no filtro", () => {
    const snapshot = buildSpendingClaritySnapshot(
      [{ tipo: "Sa\u00EDda", valor: 50, categoria: "Lazer", responsavel: "Luana", status: "Pendente" }],
      []
    );

    expect(snapshot.Luana.totalSaidasRealizadas).toBe(0);
    expect(snapshot.Luana.topCategorias).toEqual([]);
    expect(snapshot.Luana.maiorAltaVsMesAnterior).toBeNull();
  });

  it("aceita tipo sem acento (Saida) para nao perder gasto importado por variacao textual", () => {
    const snapshot = buildSpendingClaritySnapshot(
      [{ tipo: "Saida", valor: 150, categoria: "Mercado", responsavel: "Casal", status: "Realizado" }],
      []
    );

    expect(snapshot.Todos.totalSaidasRealizadas).toBe(150);
    expect(snapshot.Todos.topCategorias[0]?.categoria).toBe("Mercado");
  });

  it("exclui Fatura Cartao e Investimentos da lideranca de consumo", () => {
    const snapshot = buildSpendingClaritySnapshot(
      [
        { tipo: "Saida", valor: 1200, categoria: "Fatura Cartao", responsavel: "Casal", status: "Realizado" },
        { tipo: "Saida", valor: 300, categoria: "Investimentos", responsavel: "Casal", status: "Realizado" },
        { tipo: "Saida", valor: 500, categoria: "Alimentacao", responsavel: "Casal", status: "Realizado" },
      ],
      []
    );

    expect(snapshot.Todos.totalSaidasRealizadas).toBe(500);
    expect(snapshot.Todos.totalSaidasDesconsideradas).toBe(1500);
    expect(snapshot.Todos.topCategorias.map((item) => item.categoria)).toEqual(["Alimentacao"]);
    expect(snapshot.Todos.topCategorias[0]?.percentual).toBe(100);
  });

  it("retorna estado sem consumo quando o recorte tem apenas movimentacao financeira", () => {
    const snapshot = buildSpendingClaritySnapshot(
      [
        { tipo: "Saida", valor: 900, categoria: "Fatura Cartao", responsavel: "Casal", status: "Realizado" },
        { tipo: "Saida", valor: 200, categoria: "Investimentos", responsavel: "Casal", status: "Realizado" },
      ],
      []
    );

    expect(snapshot.Todos.totalSaidasRealizadas).toBe(0);
    expect(snapshot.Todos.totalSaidasDesconsideradas).toBe(1100);
    expect(snapshot.Todos.topCategorias).toEqual([]);
    expect(snapshot.Todos.maiorAltaVsMesAnterior).toBeNull();
  });
});
