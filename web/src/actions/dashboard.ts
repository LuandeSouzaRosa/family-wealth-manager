"use server";

import { createClient } from "@/utils/supabase/server";

// ==========================================
// DASHBOARD & ANALYTICS
// ==========================================

export async function getDashboardMetrics() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { renda: 0, despesas: 0, investido: 0, saldoTotal: 0, saldoComprometido: 0, saldoLivre: 0, contas: [] };

  // 1. Métricas do Mês Atual (Fluxo de Caixa)
  const { data: metricsMonth, error: errorMonth } = await supabase
    .from("vw_mes_atual_metricas")
    .select("*")
    .single();

  if (errorMonth && errorMonth.code !== "PGRST116") {
    console.error("Erro ao ler métricas do mês:", errorMonth);
  }

  // 2. Saldo Total Acumulado (Capital Disponível Real) e Lista de Contas
  const { data: contas } = await supabase.from("contas_bancarias").select("*");
  
  let saldoTotal = 0;
  if (contas && contas.length > 0) {
     saldoTotal = contas.reduce((acc, conta) => acc + Number(conta.saldo_atual), 0);
  } else {
     // Fallback para o cálculo antigo se não houver contas
     const { data: profile } = await supabase.from("profiles").select("saldo_inicial").single();
     const saldoInicial = profile?.saldo_inicial || 0;
     const { data: transacoes } = await supabase.from("transacoes").select("valor, tipo");
     const totalEntradas = transacoes?.filter(t => t.tipo === "Entrada").reduce((acc, t) => acc + t.valor, 0) || 0;
     const totalSaidas = transacoes?.filter(t => t.tipo === "Saída").reduce((acc, t) => acc + t.valor, 0) || 0;
     saldoTotal = saldoInicial + totalEntradas - totalSaidas;
  }

  const metrics = metricsMonth || { renda: 0, despesas: 0, investido: 0 };

  // 3. Calcular Saldo Comprometido em Metas
  const { data: metas } = await supabase.from("metas").select("valor_atual");
  const saldoComprometido = metas ? metas.reduce((acc, m) => acc + m.valor_atual, 0) : 0;
  
  const saldoLivre = saldoTotal - saldoComprometido;

  return {
    ...metrics,
    saldoTotal,
    saldoComprometido,
    saldoLivre,
    contas: contas || []
  };
}

export async function getFinancialEvolution() {
  const supabase = await createClient();
  
  // Tenta usar a RPC otimizada do PostgreSQL
  const { data, error } = await supabase.rpc('get_financial_evolution', { p_months: 6 });

  if (!error && data) {
      // Mapear retorno do RPC para o formato do gráfico
      return data.map((r: any) => {
          const [y, m] = r.month_key.split('-');
          const dateObj = new Date(parseInt(y), parseInt(m)-1, 1);
          const monthName = dateObj.toLocaleString('pt-BR', { month: 'short' });
          return {
              name: monthName.charAt(0).toUpperCase() + monthName.slice(1),
              total: Number(r.total)
          };
      });
  }

  // =================================================================================
  // FALLBACK (Lógica JS antiga) caso a RPC não tenha sido criada no banco ainda
  // =================================================================================
  console.warn("RPC get_financial_evolution não encontrada ou falhou. Usando fallback JS.");
  
  const { data: contas } = await supabase.from("contas_bancarias").select("saldo_atual");
  const { data: inv } = await supabase.from("investimentos").select("valor_atual").eq("ativo", true);
  
  const totalBancos = contas?.reduce((acc, c) => acc + (c.saldo_atual || 0), 0) || 0;
  const totalInvest = inv?.reduce((acc, i) => acc + (i.valor_atual || 0), 0) || 0;
  
  let balancePointer = totalBancos + totalInvest;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  
  const { data: transactions } = await supabase
    .from("transacoes")
    .select("data, valor, tipo")
    .gte("data", sixMonthsAgo.toISOString())
    .order("data", { ascending: false });

  const monthlyFlows: Record<string, number> = {};
  const today = new Date();
  for (let i = 0; i < 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = d.toISOString().substring(0, 7);
      monthlyFlows[key] = 0;
  }

  transactions?.forEach(t => {
      const key = t.data.substring(0, 7);
      if (monthlyFlows[key] !== undefined) {
          const val = t.tipo === 'Saída' ? -t.valor : t.valor;
          monthlyFlows[key] += val;
      }
  });

  const sortedKeys = Object.keys(monthlyFlows).sort().reverse();
  const result = [];
  
  for (const month of sortedKeys) {
      result.push({
          monthKey: month,
          saldo: balancePointer
      });
      balancePointer = balancePointer - monthlyFlows[month];
  }

  return result.reverse().map(r => {
      const [y, m] = r.monthKey.split('-');
      const dateObj = new Date(parseInt(y), parseInt(m)-1, 1);
      const monthName = dateObj.toLocaleString('pt-BR', { month: 'short' });
      return {
          name: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          total: r.saldo
      };
  });
}

export async function getFinancialHealthMetrics() {
  const supabase = await createClient();
  
  // 1. Saldo Total (Runway Base)
  const { data: contas } = await supabase.from("contas_bancarias").select("saldo_atual");
  const { data: inv } = await supabase.from("investimentos").select("valor_atual").eq("ativo", true);
  
  const totalLiquidez = contas?.reduce((acc, c) => acc + (c.saldo_atual || 0), 0) || 0;
  const totalInvestido = inv?.reduce((acc, i) => acc + (i.valor_atual || 0), 0) || 0;
  const totalPatrimonio = totalLiquidez + totalInvestido;

  // 2. Média de Despesas (Burn Rate) - Últimos 3 meses
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  const { data: transactions } = await supabase
    .from("transacoes")
    .select("valor, tipo")
    .gte("data", threeMonthsAgo.toISOString());

  let totalEntradas = 0;
  let totalSaidas = 0;

  transactions?.forEach(t => {
      if (t.tipo === 'Entrada') totalEntradas += t.valor;
      if (t.tipo === 'Saída') totalSaidas += t.valor;
  });

  // Média mensal (dividir por 3)
  const avgIncome = totalEntradas / 3;
  const avgBurnRate = totalSaidas / 3;

  // 3. Métricas
  const savingsRate = avgIncome > 0 ? ((avgIncome - avgBurnRate) / avgIncome) * 100 : 0;
  const runwayMonths = avgBurnRate > 0 ? totalLiquidez / avgBurnRate : 0; // Considera apenas liquidez imediata para runway de segurança
  const financialFreedom = avgBurnRate > 0 ? (totalPatrimonio * 0.005) / avgBurnRate * 100 : 0; // Regra dos 0.5% a.m. de renda passiva

  return {
    savingsRate,      // Taxa de Poupança (%)
    runwayMonths,     // Meses de Sobrevivência (Reserva)
    financialFreedom, // % da Independência Financeira (Regra dos 300x ou 4%)
    avgBurnRate,      // Custo de Vida Mensal
    avgIncome         // Renda Média Mensal
  };
}

export async function getCashFlowForecast() {
  const supabase = await createClient();

  // 1. Saldo Inicial (Bancos)
  const { data: contas } = await supabase.from("contas_bancarias").select("saldo_atual");
  let currentBalance = contas?.reduce((acc, c) => acc + (c.saldo_atual || 0), 0) || 0;

  // 2. Recorrências Ativas (Motor da Projeção)
  const { data: recorrentes } = await supabase
    .from("recorrentes")
    .select("*")
    .eq("ativo", true);

  if (!recorrentes || recorrentes.length === 0) return [];

  // 3. Projetar 6 Meses
  const forecast = [];
  const today = new Date();

  for (let i = 0; i < 6; i++) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const monthKey = monthDate.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
      
      // Calcular fluxo do mês baseado nas recorrências
      let monthlyIn = 0;
      let monthlyOut = 0;

      recorrentes.forEach(r => {
          // Simplificação: Assume que todas as mensais ocorrem 1x por mês
          // TODO: Melhorar lógica para quinzenal/anual se necessário
          if (r.frequencia === 'Mensal') {
             if (r.tipo === 'Entrada') monthlyIn += r.valor;
             if (r.tipo === 'Saída') monthlyOut += r.valor;
          }
      });

      // Atualizar Saldo Projetado
      currentBalance = currentBalance + monthlyIn - monthlyOut;

      forecast.push({
          month: monthKey,
          saldo: currentBalance,
          entradas: monthlyIn,
          saidas: monthlyOut
      });
  }

  return forecast;
}
