"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache";
import { calculateDashboardMetrics, calculateFinancialHealthMetrics } from "@/lib/dashboard-logic";
import { getCurrentMonthIsoRange, getPreviousMonthIsoRange } from "@/lib/period-range";
import { buildSpendingClaritySnapshot } from "@/lib/spending-clarity";

// ==========================================
// DASHBOARD & ANALYTICS (with cache)
// ==========================================

// --- Cached inner functions (use admin client + explicit user_id filter) ---

const getCachedDashboardMetrics = unstable_cache(
  async (userId: string) => {
    const supabase = createAdminClient();

    const { startIso, endExclusiveIso } = getCurrentMonthIsoRange();

    // 1. Calcular tudo diretamente usando as transações do mês em curso!
    // Substitui a View estática para blindar o status real (Agendado vs Realizado).
    const { data: monthTx, error: errorMonthTx } = await supabase
      .from("transacoes")
      .select("valor, tipo, categoria, responsavel, status")
      .eq("user_id", userId)
      .gte("data", startIso)
      .lt("data", endExclusiveIso);

    if (errorMonthTx && errorMonthTx.code !== "PGRST116") {
      console.error("Erro ao ler transações do mês para Dashboard:", errorMonthTx);
    }

    const metrics = calculateDashboardMetrics(monthTx || []);
    const { startIso: previousStartIso, endExclusiveIso: previousEndExclusiveIso } = getPreviousMonthIsoRange();

    const { data: previousMonthTx, error: errorPreviousMonthTx } = await supabase
      .from("transacoes")
      .select("valor, tipo, categoria, responsavel, status")
      .eq("user_id", userId)
      .gte("data", previousStartIso)
      .lt("data", previousEndExclusiveIso);

    if (errorPreviousMonthTx && errorPreviousMonthTx.code !== "PGRST116") {
      console.error("Erro ao ler transacoes do mes anterior para Dashboard:", errorPreviousMonthTx);
    }

    const spendingClarity = buildSpendingClaritySnapshot(monthTx || [], previousMonthTx || []);

    // 2. Saldo Total Acumulado e Lista de Contas
    const { data: contas } = await supabase
      .from("contas_bancarias")
      .select("*")
      .eq("user_id", userId);

    let saldoTotal = 0;
    if (contas && contas.length > 0) {
      saldoTotal = contas.reduce((acc, conta) => acc + Number(conta.saldo_atual), 0);
    }

    // 3. Calcular Saldo Comprometido em Metas globais
    const { data: metas } = await supabase
      .from("metas")
      .select("valor_atual")
      .eq("user_id", userId);

    const saldoComprometido = metas ? metas.reduce((acc, m) => acc + (m.valor_atual || 0), 0) : 0;
    const saldoLivre = saldoTotal - saldoComprometido;

    return {
      ...metrics,
      saldoTotal,
      saldoComprometido,
      saldoLivre,
      contas: contas || [],
      spendingClarity,
    };
  },
  ["dashboard-metrics"],
  { revalidate: 60, tags: [CACHE_TAGS.dashboard] }
);

const getCachedFinancialEvolution = unstable_cache(
  async (userId: string) => {
    const supabase = createAdminClient();

    // Tenta usar a RPC otimizada do PostgreSQL
    const { data, error } = await supabase.rpc("get_financial_evolution", { p_months: 6 });

    if (!error && data) {
      return data.map((r: any) => {
        const [y, m] = r.month_key.split("-");
        const dateObj = new Date(parseInt(y), parseInt(m) - 1, 1);
        const monthName = dateObj.toLocaleString("pt-BR", { month: "short" });
        return {
          name: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          total: Number(r.total),
        };
      });
    }

    // Fallback JS
    console.warn("RPC get_financial_evolution não encontrada ou falhou. Usando fallback JS.");

    const { data: contas } = await supabase
      .from("contas_bancarias")
      .select("saldo_atual")
      .eq("user_id", userId);

    const { data: inv } = await supabase
      .from("investimentos")
      .select("valor_atual")
      .eq("user_id", userId)
      .eq("ativo", true);

    const totalBancos = contas?.reduce((acc, c) => acc + (c.saldo_atual || 0), 0) || 0;
    const totalInvest = inv?.reduce((acc, i) => acc + (i.valor_atual || 0), 0) || 0;

    let balancePointer = totalBancos + totalInvest;

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const { data: transactions } = await supabase
      .from("transacoes")
      .select("data, valor, tipo")
      .eq("user_id", userId)
      .gte("data", sixMonthsAgo.toISOString())
      .order("data", { ascending: false });

    const monthlyFlows: Record<string, number> = {};
    const today = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = d.toISOString().substring(0, 7);
      monthlyFlows[key] = 0;
    }

    transactions?.forEach((t) => {
      const key = t.data.substring(0, 7);
      if (monthlyFlows[key] !== undefined) {
        const val = t.tipo === "Saída" ? -t.valor : t.valor;
        monthlyFlows[key] += val;
      }
    });

    const sortedKeys = Object.keys(monthlyFlows).sort().reverse();
    const result = [];

    for (const month of sortedKeys) {
      result.push({
        monthKey: month,
        saldo: balancePointer,
      });
      balancePointer = balancePointer - monthlyFlows[month];
    }

    return result.reverse().map((r) => {
      const [y, m] = r.monthKey.split("-");
      const dateObj = new Date(parseInt(y), parseInt(m) - 1, 1);
      const monthName = dateObj.toLocaleString("pt-BR", { month: "short" });
      return {
        name: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        total: r.saldo,
      };
    });
  },
  ["financial-evolution"],
  { revalidate: 60, tags: [CACHE_TAGS.dashboard] }
);

const getCachedFinancialHealthMetrics = unstable_cache(
  async (userId: string) => {
    const supabase = createAdminClient();

    // 1. Saldo Total (Runway Base)
    const { data: contas } = await supabase
      .from("contas_bancarias")
      .select("saldo_atual")
      .eq("user_id", userId);

    const { data: inv } = await supabase
      .from("investimentos")
      .select("valor_atual")
      .eq("user_id", userId)
      .eq("ativo", true);

    const totalLiquidez = contas?.reduce((acc, c) => acc + (c.saldo_atual || 0), 0) || 0;
    const totalInvestido = inv?.reduce((acc, i) => acc + (i.valor_atual || 0), 0) || 0;
    const totalPatrimonio = totalLiquidez + totalInvestido;

    // 2. Média de Despesas (Burn Rate) - Últimos 3 meses
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data: transactions } = await supabase
      .from("transacoes")
      .select("valor, tipo, data, status")
      .eq("user_id", userId)
      .gte("data", threeMonthsAgo.toISOString());

    const { avgIncome, avgBurnRate } = calculateFinancialHealthMetrics(transactions || [], 3);

    // 3. Métricas
    const savingsRate = avgIncome > 0 ? ((avgIncome - avgBurnRate) / avgIncome) * 100 : 0;
    const runwayMonths = avgBurnRate > 0 ? totalLiquidez / avgBurnRate : 0;
    const financialFreedom = avgBurnRate > 0 ? ((totalPatrimonio * 0.005) / avgBurnRate) * 100 : 0;

    return {
      savingsRate,
      runwayMonths,
      financialFreedom,
      avgBurnRate,
      avgIncome,
    };
  },
  ["financial-health"],
  { revalidate: 60, tags: [CACHE_TAGS.dashboard] }
);

const getCachedCashFlowForecast = unstable_cache(
  async (userId: string) => {
    const supabase = createAdminClient();

    // 1. Saldo Inicial (Bancos)
    const { data: contas } = await supabase
      .from("contas_bancarias")
      .select("saldo_atual")
      .eq("user_id", userId);

    let currentBalance = contas?.reduce((acc, c) => acc + (c.saldo_atual || 0), 0) || 0;

    // 2. Recorrências Ativas
    const { data: recorrentes } = await supabase
      .from("recorrentes")
      .select("*")
      .eq("user_id", userId)
      .eq("ativo", true);

    if (!recorrentes || recorrentes.length === 0) return [];

    // 3. Projetar 6 Meses
    const forecast = [];
    const today = new Date();

    for (let i = 0; i < 6; i++) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const monthKey = monthDate.toLocaleString("pt-BR", { month: "short", year: "2-digit" });

      let monthlyIn = 0;
      let monthlyOut = 0;

      recorrentes.forEach((r) => {
        if (r.frequencia === "Mensal") {
          if (r.tipo === "Entrada") monthlyIn += r.valor;
          if (r.tipo === "Saída") monthlyOut += r.valor;
        }
      });

      currentBalance = currentBalance + monthlyIn - monthlyOut;

      forecast.push({
        month: monthKey,
        saldo: currentBalance,
        entradas: monthlyIn,
        saidas: monthlyOut,
      });
    }

    return forecast;
  },
  ["cash-flow-forecast"],
  { revalidate: 60, tags: [CACHE_TAGS.dashboard] }
);

// --- Public API (auth wrapper → cached function) ---

export async function getDashboardMetrics() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {
    renda: 0,
    despesas: 0,
    investido: 0,
    saldoTotal: 0,
    saldoComprometido: 0,
    saldoLivre: 0,
    contas: [],
    spendingClarity: {
      Todos: {
        totalSaidasRealizadas: 0,
        topCategorias: [],
        concentracaoTop3Percentual: 0,
        totalRecorrente: 0,
        totalPontual: 0,
        percentualRecorrente: 0,
        percentualPontual: 0,
        maiorAltaVsMesAnterior: null,
      },
      Luan: {
        totalSaidasRealizadas: 0,
        topCategorias: [],
        concentracaoTop3Percentual: 0,
        totalRecorrente: 0,
        totalPontual: 0,
        percentualRecorrente: 0,
        percentualPontual: 0,
        maiorAltaVsMesAnterior: null,
      },
      Luana: {
        totalSaidasRealizadas: 0,
        topCategorias: [],
        concentracaoTop3Percentual: 0,
        totalRecorrente: 0,
        totalPontual: 0,
        percentualRecorrente: 0,
        percentualPontual: 0,
        maiorAltaVsMesAnterior: null,
      },
      Casal: {
        totalSaidasRealizadas: 0,
        topCategorias: [],
        concentracaoTop3Percentual: 0,
        totalRecorrente: 0,
        totalPontual: 0,
        percentualRecorrente: 0,
        percentualPontual: 0,
        maiorAltaVsMesAnterior: null,
      },
    },
  };

  return getCachedDashboardMetrics(user.id);
}

export async function getFinancialEvolution() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  return getCachedFinancialEvolution(user.id);
}

export async function getFinancialHealthMetrics() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { savingsRate: 0, runwayMonths: 0, financialFreedom: 0, avgBurnRate: 0, avgIncome: 0 };

  return getCachedFinancialHealthMetrics(user.id);
}

export async function getCashFlowForecast() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  return getCachedCashFlowForecast(user.id);
}
