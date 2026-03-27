import { Database } from "@/types/database"; // Assuming typings or just pure objects

export interface DashboardTransactionInput {
  valor: number | string;
  tipo: string;
  responsavel: string | null;
  status: string | null;
}

export interface DashboardMetricsOutput {
  renda: number;
  despesas: number;
  rendaRealizada: number;
  rendaAgendada: number;
  despesasRealizadas: number;
  despesasAgendadas: number;
  investido: number;
  porResponsavel: {
    [key: string]: {
      rendaRealizada: number;
      rendaAgendada: number;
      despesasRealizadas: number;
      despesasAgendadas: number;
      renda: number;
      despesas: number;
    };
  };
}

export function calculateDashboardMetrics(monthTx: DashboardTransactionInput[]): DashboardMetricsOutput {
  let globalRendaRealizada = 0;
  let globalRendaAgendada = 0;
  let globalDespesasRealizadas = 0;
  let globalDespesasAgendadas = 0;
  let investido = 0;

  const porResponsavel: Record<string, { rendaRealizada: number, rendaAgendada: number, despesasRealizadas: number, despesasAgendadas: number, renda: number, despesas: number }> = {
     "Luan": { rendaRealizada: 0, rendaAgendada: 0, despesasRealizadas: 0, despesasAgendadas: 0, renda: 0, despesas: 0 },
     "Luana": { rendaRealizada: 0, rendaAgendada: 0, despesasRealizadas: 0, despesasAgendadas: 0, renda: 0, despesas: 0 },
     "Casal": { rendaRealizada: 0, rendaAgendada: 0, despesasRealizadas: 0, despesasAgendadas: 0, renda: 0, despesas: 0 }
  };

  monthTx.forEach(tx => {
     const resp = tx.responsavel || "Casal";
     const val = Number(tx.valor) || 0;
     const isAgendado = tx.status === "Agendado" || tx.status === "Pendente";
     
     if (tx.tipo === "Transferência") {
         if (!isAgendado) investido += val;
     } else if (tx.tipo === "Entrada") {
         if (isAgendado) {
             globalRendaAgendada += val;
             if (porResponsavel[resp]) porResponsavel[resp].rendaAgendada += val;
         } else {
             globalRendaRealizada += val;
             if (porResponsavel[resp]) porResponsavel[resp].rendaRealizada += val;
         }
         if (porResponsavel[resp]) porResponsavel[resp].renda += val;
     } else if (tx.tipo === "Saída") {
         if (isAgendado) {
             globalDespesasAgendadas += val;
             if (porResponsavel[resp]) porResponsavel[resp].despesasAgendadas += val;
         } else {
             globalDespesasRealizadas += val;
             if (porResponsavel[resp]) porResponsavel[resp].despesasRealizadas += val;
         }
         if (porResponsavel[resp]) porResponsavel[resp].despesas += val;
     }
  });

  return {
      renda: globalRendaRealizada + globalRendaAgendada,
      despesas: globalDespesasRealizadas + globalDespesasAgendadas,
      rendaRealizada: globalRendaRealizada,
      rendaAgendada: globalRendaAgendada,
      despesasRealizadas: globalDespesasRealizadas,
      despesasAgendadas: globalDespesasAgendadas,
      investido,
      porResponsavel,
  };
}

export interface FinancialHealthInput {
  valor: number | string;
  tipo: string;
  data: string;
  status: string | null;
}

export function calculateFinancialHealthMetrics(
  transactions: FinancialHealthInput[],
  limitMonths: number = 3
): { avgIncome: number; avgBurnRate: number } {
  const monthlyIncomes: Record<string, number> = {};
  const monthlyBurnRates: Record<string, number> = {};

  const today = new Date(); // Referência estrita (evita vazamento de agendamentos longos)
  const timeLimit = new Date();
  timeLimit.setMonth(timeLimit.getMonth() - limitMonths);

  transactions.forEach((tx) => {
    // Fuga do futuro e ambiguidade:
    // Apenas transações "Realizadas" participam do Burn Rate Histórico puro.
    // Ignorar "Pendente/Agendado" evita que o financiamento parcelado em 12x estoure o cálculo no cenário M-1 a M-3
    if (tx.status === "Agendado" || tx.status === "Pendente") return;

    const txDate = new Date(tx.data);
    if (txDate > today || txDate < timeLimit) return;

    const monthKey = tx.data.substring(0, 7); // Ex: "2023-05"
    const val = Number(tx.valor) || 0;

    if (!monthlyIncomes[monthKey]) monthlyIncomes[monthKey] = 0;
    if (!monthlyBurnRates[monthKey]) monthlyBurnRates[monthKey] = 0;

    if (tx.tipo === "Entrada") {
      monthlyIncomes[monthKey] += val;
    } else if (tx.tipo === "Saída") {
      monthlyBurnRates[monthKey] += val;
    }
  });

  // Função auxiliar matemática de Mediana (Fuga do Outlier Lógico - Capex sem suor)
  const getMedian = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const incomeValues = Object.values(monthlyIncomes).filter(v => v > 0);
  const burnRateValues = Object.values(monthlyBurnRates).filter(v => v > 0);

  // Se o histórico for escasso espúrio (ex: houve entrada mas nenhuma despesa cadastrada no mês),
  // ignoramos o "0" para não cravar a mediana em "R$ 0 de custo de vida", o que causaria Risco Otimista.
  return {
    avgIncome: getMedian(incomeValues),
    avgBurnRate: getMedian(burnRateValues),
  };
}
