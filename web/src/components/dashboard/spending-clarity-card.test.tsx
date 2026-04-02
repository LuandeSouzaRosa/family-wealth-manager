/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SpendingClarityCard } from "./spending-clarity-card";

const emptyData = {
  totalSaidasRealizadas: 0,
  topCategorias: [],
  concentracaoTop3Percentual: 0,
  totalRecorrente: 0,
  totalPontual: 0,
  percentualRecorrente: 0,
  percentualPontual: 0,
  maiorAltaVsMesAnterior: null,
};

describe("SpendingClarityCard", () => {
  it("mostra fallback honesto quando filtro esta vazio mas ha saidas em Todos", () => {
    render(
      <SpendingClarityCard
        data={emptyData}
        responsavel="Luana"
        totalSaidasRealizadasTodos={1200}
      />
    );

    expect(
      screen.getByText(/ja houve saidas realizadas no mes, mas nao neste filtro de responsavel/i)
    ).toBeTruthy();
  });

  it("prioriza aviso de classificacao generica quando categoria lider e Outros", () => {
    render(
      <SpendingClarityCard
        data={{
          totalSaidasRealizadas: 1000,
          topCategorias: [
            { categoria: "Outros", total: 900, percentual: 90, lancamentos: 8 },
            { categoria: "Moradia", total: 100, percentual: 10, lancamentos: 1 },
          ],
          concentracaoTop3Percentual: 100,
          totalRecorrente: 0,
          totalPontual: 1000,
          percentualRecorrente: 0,
          percentualPontual: 100,
          maiorAltaVsMesAnterior: null,
        }}
        responsavel="Todos"
      />
    );

    expect(screen.getByText(/classificacao ainda generica/i)).toBeTruthy();
    expect(screen.getByText(/classificar os principais lancamentos deixa o insight mais confiavel/i)).toBeTruthy();
  });

  it("usa deep-link explicito para extrato quando href contextual e informado", () => {
    render(
      <SpendingClarityCard
        data={emptyData}
        responsavel="Todos"
        transacoesHref="/transacoes?month=4&year=2026"
      />
    );

    const action = screen.getByRole("button", { name: /revisar no extrato/i }).closest("a");
    expect(action?.getAttribute("href")).toBe("/transacoes?month=4&year=2026");
  });

  it("torna o insight acionavel com categoria lider e ordenacao util", () => {
    render(
      <SpendingClarityCard
        data={{
          totalSaidasRealizadas: 1800,
          topCategorias: [
            { categoria: "Alimentacao", total: 900, percentual: 50, lancamentos: 6 },
          ],
          concentracaoTop3Percentual: 50,
          totalRecorrente: 700,
          totalPontual: 1100,
          percentualRecorrente: 39,
          percentualPontual: 61,
          maiorAltaVsMesAnterior: null,
        }}
        responsavel="Todos"
        transacoesHref="/transacoes?month=4&year=2026"
      />
    );

    const action = screen.getByRole("button", { name: /revisar no extrato/i }).closest("a");
    const href = action?.getAttribute("href") || "";
    const url = new URL(href, "http://fwm.local");

    expect(url.pathname).toBe("/transacoes");
    expect(url.searchParams.get("month")).toBe("4");
    expect(url.searchParams.get("year")).toBe("2026");
    expect(url.searchParams.get("category")).toBe("Alimentacao");
    expect(url.searchParams.get("sort")).toBe("value_desc");
  });
});
