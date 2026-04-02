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
  totalSaidasDesconsideradas?: number;
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
  totalSaidasDesconsideradas: 0,
  topCategorias: [],
  concentracaoTop3Percentual: 0,
  totalRecorrente: 0,
  totalPontual: 0,
  percentualRecorrente: 0,
  percentualPontual: 0,
  maiorAltaVsMesAnterior: null,
};

const RESPONSAVEL_FILTROS: ResponsibleFilter[] = ["Todos", "Luan", "Luana", "Casal"];
const NON_CONSUMPTION_CATEGORY_TOKENS = new Set(["fatura cartao", "investimentos"]);

function normalizeToken(value: string | null | undefined): string {
  return (value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeMoney(value: number | string): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isExpenseType(tipo: string): boolean {
  const normalized = normalizeToken(tipo);
  return normalized === "saida";
}

function isRealized(status: string | null): boolean {
  const normalized = normalizeToken(status);
  return normalized !== "agendado" && normalized !== "pendente";
}

function isNonConsumptionCategory(categoria: string): boolean {
  return NON_CONSUMPTION_CATEGORY_TOKENS.has(normalizeToken(categoria));
}

function filterConsumptionAggregate(
  totals: Map<string, number>,
  counts: Map<string, number>
) {
  const filteredTotals = new Map<string, number>();
  const filteredCounts = new Map<string, number>();
  let excludedTotal = 0;
  let filteredTotal = 0;

  totals.forEach((total, categoria) => {
    if (isNonConsumptionCategory(categoria)) {
      excludedTotal += total;
      return;
    }

    filteredTotals.set(categoria, total);
    filteredCounts.set(categoria, counts.get(categoria) || 0);
    filteredTotal += total;
  });

  return { filteredTotals, filteredCounts, filteredTotal, excludedTotal };
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
  const currentRaw = aggregateByCategory(currentMonthTx, filtro);
  const previousRaw = aggregateByCategory(previousMonthTx, filtro);

  if (currentRaw.totalSaidasRealizadas <= 0) return EMPTY_VIEW;

  const current = filterConsumptionAggregate(currentRaw.totals, currentRaw.counts);
  const previous = filterConsumptionAggregate(previousRaw.totals, previousRaw.counts);

  if (current.filteredTotal <= 0) {
    return {
      ...EMPTY_VIEW,
      totalSaidasDesconsideradas: current.excludedTotal,
    };
  }

  const topCategorias = Array.from(current.filteredTotals.entries())
    .map(([categoria, total]) => ({
      categoria,
      total,
      percentual: (total / current.filteredTotal) * 100,
      lancamentos: current.filteredCounts.get(categoria) || 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  const totalTop3 = topCategorias.reduce((acc, item) => acc + item.total, 0);
  const concentracaoTop3Percentual = (totalTop3 / current.filteredTotal) * 100;

  let totalRecorrente = 0;
  current.filteredTotals.forEach((total, categoria) => {
    const count = current.filteredCounts.get(categoria) || 0;
    if (count >= 3) {
      totalRecorrente += total;
    }
  });

  const totalPontual = current.filteredTotal - totalRecorrente;
  const percentualRecorrente = (totalRecorrente / current.filteredTotal) * 100;
  const percentualPontual = (totalPontual / current.filteredTotal) * 100;

  let maiorAltaVsMesAnterior: CategoryIncreaseInsight | null = null;
  current.filteredTotals.forEach((atual, categoria) => {
    const anterior = previous.filteredTotals.get(categoria) || 0;
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
    totalSaidasRealizadas: current.filteredTotal,
    totalSaidasDesconsideradas: current.excludedTotal,
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
