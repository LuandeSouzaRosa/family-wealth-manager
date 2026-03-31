import { describe, it, expect } from "vitest";
import { getCurrentMonthIsoRange, getPreviousMonthIsoRange } from "./period-range";

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
