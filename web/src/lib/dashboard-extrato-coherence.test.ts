import { describe, expect, it } from "vitest";
import { calculateDashboardMetrics } from "./dashboard-logic";
import { isResponsibleMatch } from "./filter-utils";
import { getCurrentMonthIsoRange } from "./period-range";

type ResponsibleFilter = "Todos" | "Luan" | "Luana" | "Casal";

type CoherenceTx = {
  descricao: string;
  valor: number;
  tipo: "Entrada" | "Sa\u00edda" | "Transfer\u00eancia";
  responsavel: "Luan" | "Luana" | "Casal";
  status: "Realizado" | "Agendado" | "Pendente";
  data: string;
};

const SAIDA = "Sa\u00edda" as const;
const TRANSFERENCIA = "Transfer\u00eancia" as const;
const REFERENCE_DATE = new Date("2026-03-15T12:00:00.000Z");

const DATASET: CoherenceTx[] = [
  {
    descricao: "Luan entrada no mes",
    valor: 1000,
    tipo: "Entrada",
    responsavel: "Luan",
    status: "Realizado",
    data: "2026-03-05T12:00:00.000Z",
  },
  {
    descricao: "Luan saida no mes",
    valor: 200,
    tipo: SAIDA,
    responsavel: "Luan",
    status: "Realizado",
    data: "2026-03-06T12:00:00.000Z",
  },
  {
    descricao: "Luan saida agendada no mes",
    valor: 50,
    tipo: SAIDA,
    responsavel: "Luan",
    status: "Agendado",
    data: "2026-03-25T12:00:00.000Z",
  },
  {
    descricao: "Luana entrada no mes",
    valor: 700,
    tipo: "Entrada",
    responsavel: "Luana",
    status: "Realizado",
    data: "2026-03-08T12:00:00.000Z",
  },
  {
    descricao: "Luana saida no mes",
    valor: 300,
    tipo: SAIDA,
    responsavel: "Luana",
    status: "Realizado",
    data: "2026-03-10T12:00:00.000Z",
  },
  {
    descricao: "Casal saida no mes",
    valor: 400,
    tipo: SAIDA,
    responsavel: "Casal",
    status: "Realizado",
    data: "2026-03-15T12:00:00.000Z",
  },
  {
    descricao: "Transferencia no mes nao entra em renda/despesa",
    valor: 600,
    tipo: TRANSFERENCIA,
    responsavel: "Casal",
    status: "Realizado",
    data: "2026-03-18T12:00:00.000Z",
  },
  {
    descricao: "Fora do mes (abril) com valor alto para detectar vazamento",
    valor: 9999,
    tipo: SAIDA,
    responsavel: "Luan",
    status: "Realizado",
    data: "2026-04-02T12:00:00.000Z",
  },
  {
    descricao: "Fora do mes (fevereiro) com valor alto para detectar vazamento",
    valor: 8888,
    tipo: "Entrada",
    responsavel: "Casal",
    status: "Realizado",
    data: "2026-02-28T12:00:00.000Z",
  },
];

const EXPECTED_TOTALS: Record<ResponsibleFilter, { renda: number; despesas: number }> = {
  Todos: { renda: 1700, despesas: 950 },
  Luan: { renda: 1000, despesas: 250 },
  Luana: { renda: 700, despesas: 300 },
  Casal: { renda: 0, despesas: 400 },
};

function getDashboardTotals(
  txs: CoherenceTx[],
  referenceDate: Date,
  responsavel: ResponsibleFilter
): { renda: number; despesas: number } {
  const { startIso, endExclusiveIso } = getCurrentMonthIsoRange(referenceDate);

  const monthTx = txs.filter((tx) => tx.data >= startIso && tx.data < endExclusiveIso);
  const metrics = calculateDashboardMetrics(monthTx);

  if (responsavel === "Todos") {
    return { renda: metrics.renda, despesas: metrics.despesas };
  }

  const scoped = metrics.porResponsavel[responsavel];
  return { renda: scoped.renda, despesas: scoped.despesas };
}

function getExtratoTotals(
  txs: CoherenceTx[],
  referenceDate: Date,
  responsavel: ResponsibleFilter
): { renda: number; despesas: number } {
  const month = referenceDate.getMonth() + 1;
  const year = referenceDate.getFullYear();

  let filtered = txs.filter((tx) => {
    const txDate = new Date(tx.data);
    return txDate.getMonth() + 1 === month && txDate.getFullYear() === year;
  });

  if (responsavel !== "Todos") {
    filtered = filtered.filter((tx) => isResponsibleMatch(tx.responsavel, responsavel));
  }

  const renda = filtered
    .filter((tx) => tx.tipo === "Entrada")
    .reduce((acc, tx) => acc + tx.valor, 0);
  const despesas = filtered
    .filter((tx) => tx.tipo === SAIDA)
    .reduce((acc, tx) => acc + tx.valor, 0);

  return { renda, despesas };
}

describe("dashboard x extrato coherence invariant", () => {
  it("mantem igualdade entre agregado e detalhado no mesmo recorte de periodo e responsavel", () => {
    const filters: ResponsibleFilter[] = ["Todos", "Luan", "Luana", "Casal"];

    filters.forEach((responsavel) => {
      const dashboard = getDashboardTotals(DATASET, REFERENCE_DATE, responsavel);
      const extrato = getExtratoTotals(DATASET, REFERENCE_DATE, responsavel);

      expect(dashboard).toEqual(extrato);
      expect(dashboard).toEqual(EXPECTED_TOTALS[responsavel]);
    });
  });

  it("nao vaza valores fora do mes no agregado nem no detalhado", () => {
    const dashboardTodos = getDashboardTotals(DATASET, REFERENCE_DATE, "Todos");
    const extratoTodos = getExtratoTotals(DATASET, REFERENCE_DATE, "Todos");

    expect(dashboardTodos).toEqual({ renda: 1700, despesas: 950 });
    expect(extratoTodos).toEqual({ renda: 1700, despesas: 950 });
  });
});
