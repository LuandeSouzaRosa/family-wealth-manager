/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

  it("mostra estado honesto quando o recorte so tem movimentacao financeira", () => {
    render(
      <SpendingClarityCard
        data={{
          totalSaidasRealizadas: 0,
          totalSaidasDesconsideradas: 1600,
          topCategorias: [],
          concentracaoTop3Percentual: 0,
          totalRecorrente: 0,
          totalPontual: 0,
          percentualRecorrente: 0,
          percentualPontual: 0,
          maiorAltaVsMesAnterior: null,
        }}
        responsavel="Todos"
      />
    );

    expect(screen.getByText(/movimentacoes financeiras dominaram este recorte/i)).toBeTruthy();
    expect(screen.queryByText(/nao houve saidas realizadas neste recorte/i)).toBeNull();
    expect(screen.getByRole("button", { name: /revisar no extrato/i })).toBeTruthy();
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
    const evidence = screen.getByTestId("spending-clarity-evidence-strength");
    expect(within(evidence).getByText(/confianca do insight:/i)).toBeTruthy();
    expect(within(evidence).getByText(/^baixa$/i)).toBeTruthy();
    const evidenceSignals = screen.getByTestId("spending-clarity-evidence-signals");
    expect(evidenceSignals.textContent || "").toMatch(/lider 90% em 8 lanc\.; generico no top 3 90%\./i);
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

  it("sinaliza confianca alta quando a categoria lider tem sustentacao forte", () => {
    render(
      <SpendingClarityCard
        data={{
          totalSaidasRealizadas: 1000,
          topCategorias: [
            { categoria: "Transporte", total: 550, percentual: 55, lancamentos: 4 },
            { categoria: "Alimentacao", total: 300, percentual: 30, lancamentos: 3 },
            { categoria: "Lazer", total: 150, percentual: 15, lancamentos: 2 },
          ],
          concentracaoTop3Percentual: 100,
          totalRecorrente: 550,
          totalPontual: 450,
          percentualRecorrente: 55,
          percentualPontual: 45,
          maiorAltaVsMesAnterior: null,
        }}
        responsavel="Todos"
      />
    );

    const evidence = screen.getByTestId("spending-clarity-evidence-strength");
    expect(within(evidence).getByText(/confianca do insight:/i)).toBeTruthy();
    expect(within(evidence).getByText(/^alta$/i)).toBeTruthy();
    const evidenceSignals = screen.getByTestId("spending-clarity-evidence-signals");
    expect(evidenceSignals.textContent || "").toMatch(/lider 55% em 4 lanc\.; generico no top 3 0%\./i);
    expect(screen.getByText(/ajuste sugerido de maior impacto/i)).toBeTruthy();
    expect(screen.getByText(/revise agora as 3 categorias lideres no extrato e corte pelo menos 1 item de cada\./i)).toBeTruthy();
  });

  it("explica confianca moderada com sinais objetivos do recorte", () => {
    render(
      <SpendingClarityCard
        data={{
          totalSaidasRealizadas: 80.62,
          topCategorias: [
            { categoria: "Alimentacao", total: 80.62, percentual: 100, lancamentos: 2 },
          ],
          concentracaoTop3Percentual: 100,
          totalRecorrente: 0,
          totalPontual: 80.62,
          percentualRecorrente: 0,
          percentualPontual: 100,
          maiorAltaVsMesAnterior: null,
        }}
        responsavel="Todos"
      />
    );

    const evidence = screen.getByTestId("spending-clarity-evidence-strength");
    expect(within(evidence).getByText(/confianca do insight:/i)).toBeTruthy();
    expect(within(evidence).getByText(/^moderada$/i)).toBeTruthy();
    const evidenceSignals = screen.getByTestId("spending-clarity-evidence-signals");
    expect(evidenceSignals.textContent || "").toMatch(/lider 100% em 2 lanc\.; generico no top 3 0%\./i);
    expect(screen.getByText(/ajuste sugerido \(confirmar no extrato\)/i)).toBeTruthy();
    expect(screen.getByText(/use o insight como direcao inicial/i)).toBeTruthy();
    expect(screen.queryByText(/corte pelo menos 1 item de cada/i)).toBeNull();
  });

  it("reduz tom prescritivo quando confianca e baixa por pouca sustentacao do lider", () => {
    render(
      <SpendingClarityCard
        data={{
          totalSaidasRealizadas: 100,
          topCategorias: [
            { categoria: "Transporte", total: 80, percentual: 80, lancamentos: 1 },
            { categoria: "Lazer", total: 20, percentual: 20, lancamentos: 2 },
          ],
          concentracaoTop3Percentual: 100,
          totalRecorrente: 0,
          totalPontual: 100,
          percentualRecorrente: 0,
          percentualPontual: 100,
          maiorAltaVsMesAnterior: null,
        }}
        responsavel="Todos"
      />
    );

    const evidence = screen.getByTestId("spending-clarity-evidence-strength");
    expect(within(evidence).getByText(/^baixa$/i)).toBeTruthy();
    expect(screen.getByText(/base fraca para prescrever corte/i)).toBeTruthy();
    expect(screen.queryByText(/corte pelo menos 1 item de cada/i)).toBeNull();
  });
});
