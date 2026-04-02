import { describe, it, expect } from "vitest";
import {
  getCurrentMonthIsoRange,
  getPreviousMonthIsoRange,
  getYearFilterOptions,
} from "./period-range";

describe("getCurrentMonthIsoRange", () => {
  it("retorna janela fechada-aberta do mes corrente", () => {
    const ref = new Date("2026-03-15T12:00:00.000Z");
    const range = getCurrentMonthIsoRange(ref);
    const expectedStart = new Date(ref.getFullYear(), ref.getMonth(), 1).toISOString();
    const expectedEndExclusive = new Date(ref.getFullYear(), ref.getMonth() + 1, 1).toISOString();

    expect(range.startIso).toBe(expectedStart);
    expect(range.endExclusiveIso).toBe(expectedEndExclusive);
  });

  it("faz rollover correto de dezembro para janeiro", () => {
    const ref = new Date("2026-12-20T08:30:00.000Z");
    const range = getCurrentMonthIsoRange(ref);
    const expectedStart = new Date(ref.getFullYear(), ref.getMonth(), 1).toISOString();
    const expectedEndExclusive = new Date(ref.getFullYear(), ref.getMonth() + 1, 1).toISOString();

    expect(range.startIso).toBe(expectedStart);
    expect(range.endExclusiveIso).toBe(expectedEndExclusive);
  });
});

describe("getPreviousMonthIsoRange", () => {
  it("retorna janela fechada-aberta do mes anterior", () => {
    const ref = new Date("2026-03-15T12:00:00.000Z");
    const range = getPreviousMonthIsoRange(ref);
    const expectedStart = new Date(ref.getFullYear(), ref.getMonth() - 1, 1).toISOString();
    const expectedEndExclusive = new Date(ref.getFullYear(), ref.getMonth(), 1).toISOString();

    expect(range.startIso).toBe(expectedStart);
    expect(range.endExclusiveIso).toBe(expectedEndExclusive);
  });

  it("faz rollover correto de janeiro para dezembro do ano anterior", () => {
    const ref = new Date("2026-01-20T08:30:00.000Z");
    const range = getPreviousMonthIsoRange(ref);
    const expectedStart = new Date(ref.getFullYear(), ref.getMonth() - 1, 1).toISOString();
    const expectedEndExclusive = new Date(ref.getFullYear(), ref.getMonth(), 1).toISOString();

    expect(range.startIso).toBe(expectedStart);
    expect(range.endExclusiveIso).toBe(expectedEndExclusive);
  });
});

describe("getYearFilterOptions", () => {
  it("retorna faixa dinamica baseada no ano atual", () => {
    const ref = new Date("2026-03-15T12:00:00.000Z");
    expect(getYearFilterOptions("2026", ref)).toEqual(["2026", "2025", "2024"]);
  });

  it("inclui ano selecionado fora da faixa para manter previsibilidade do filtro", () => {
    const ref = new Date("2026-03-15T12:00:00.000Z");
    expect(getYearFilterOptions("2022", ref)).toEqual(["2026", "2025", "2024", "2022"]);
  });

  it("nao inclui ano selecionado invalido", () => {
    const ref = new Date("2026-03-15T12:00:00.000Z");
    expect(getYearFilterOptions("Todos", ref)).toEqual(["2026", "2025", "2024"]);
    expect(getYearFilterOptions("0", ref)).toEqual(["2026", "2025", "2024"]);
  });
});
