import { isResponsibleMatch } from "./filter-utils";

export type ResponsibleFilter = "Todos" | "Luan" | "Luana" | "Casal";

export interface SpendingClarityInput {
  valor: number | string;
  tipo: string;
  categoria: string | null;
  responsavel: string | null;
  status: string | null;
}

export interface TopCategoryInsight {
  categoria: string;
  total: number;
  percentual: number;
  lancamentos: number;
}

export interface CategoryIncreaseInsight {
  categoria: string;
  delta: number;
  atual: number;
  anterior: number;
}

export interface SpendingClarityView {
  totalSaidasRealizadas: number;
  topCategorias: TopCategoryInsight[];
  concentracaoTop3Percentual: number;
  totalRecorrente: number;
  totalPontual: number;
  percentualRecorrente: number;
  percentualPontual: number;
  maiorAltaVsMesAnterior: CategoryIncreaseInsight | null;
}

export type SpendingClaritySnapshot = Record<ResponsibleFilter, SpendingClarityView>;

const EMPTY_VIEW: SpendingClarityView = {
  totalSaidasRealizadas: 0,
  topCategorias: [],
  concentracaoTop3Percentual: 0,
  totalRecorrente: 0,
  totalPontual: 0,
  percentualRecorrente: 0,
  percentualPontual: 0,
  maiorAltaVsMesAnterior: null,
};

const RESPONSAVEL_FILTROS: ResponsibleFilter[] = ["Todos", "Luan", "Luana", "Casal"];
const SAIDA_VARIANTS = new Set(["saída", "saÃ­da"]);

function normalizeMoney(value: number | string): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isExpenseType(tipo: string): boolean {
  const normalized = (tipo || "").trim().toLowerCase();
  return SAIDA_VARIANTS.has(normalized);
}

function isRealized(status: string | null): boolean {
  return status !== "Agendado" && status !== "Pendente";
}

function aggregateByCategory(
  transactions: SpendingClarityInput[],
  filtro: ResponsibleFilter
) {
  const totals = new Map<string, number>();
  const counts = new Map<string, number>();
  let totalSaidasRealizadas = 0;

  transactions.forEach((tx) => {
    if (!isExpenseType(tx.tipo)) return;
    if (!isRealized(tx.status)) return;
    if (!isResponsibleMatch(tx.responsavel, filtro)) return;

    const value = normalizeMoney(tx.valor);
    if (value <= 0) return;

    const categoria = tx.categoria?.trim() || "Sem categoria";
    totalSaidasRealizadas += value;
    totals.set(categoria, (totals.get(categoria) || 0) + value);
    counts.set(categoria, (counts.get(categoria) || 0) + 1);
  });

  return { totals, counts, totalSaidasRealizadas };
}

function buildView(
  currentMonthTx: SpendingClarityInput[],
  previousMonthTx: SpendingClarityInput[],
  filtro: ResponsibleFilter
): SpendingClarityView {
  const current = aggregateByCategory(currentMonthTx, filtro);
  const previous = aggregateByCategory(previousMonthTx, filtro);

  if (current.totalSaidasRealizadas <= 0) return EMPTY_VIEW;

  const topCategorias = Array.from(current.totals.entries())
    .map(([categoria, total]) => ({
      categoria,
      total,
      percentual: (total / current.totalSaidasRealizadas) * 100,
      lancamentos: current.counts.get(categoria) || 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  const totalTop3 = topCategorias.reduce((acc, item) => acc + item.total, 0);
  const concentracaoTop3Percentual = (totalTop3 / current.totalSaidasRealizadas) * 100;

  let totalRecorrente = 0;
  current.totals.forEach((total, categoria) => {
    const count = current.counts.get(categoria) || 0;
    if (count >= 3) {
      totalRecorrente += total;
    }
  });

  const totalPontual = current.totalSaidasRealizadas - totalRecorrente;
  const percentualRecorrente = (totalRecorrente / current.totalSaidasRealizadas) * 100;
  const percentualPontual = (totalPontual / current.totalSaidasRealizadas) * 100;

  let maiorAltaVsMesAnterior: CategoryIncreaseInsight | null = null;
  current.totals.forEach((atual, categoria) => {
    const anterior = previous.totals.get(categoria) || 0;
    const delta = atual - anterior;
    if (delta <= 0) return;

    if (!maiorAltaVsMesAnterior || delta > maiorAltaVsMesAnterior.delta) {
      maiorAltaVsMesAnterior = {
        categoria,
        delta,
        atual,
        anterior,
      };
    }
  });

  return {
    totalSaidasRealizadas: current.totalSaidasRealizadas,
    topCategorias,
    concentracaoTop3Percentual,
    totalRecorrente,
    totalPontual,
    percentualRecorrente,
    percentualPontual,
    maiorAltaVsMesAnterior,
  };
}

export function buildSpendingClaritySnapshot(
  currentMonthTx: SpendingClarityInput[],
  previousMonthTx: SpendingClarityInput[]
): SpendingClaritySnapshot {
  return RESPONSAVEL_FILTROS.reduce((acc, filtro) => {
    acc[filtro] = buildView(currentMonthTx, previousMonthTx, filtro);
    return acc;
  }, {} as SpendingClaritySnapshot);
}
