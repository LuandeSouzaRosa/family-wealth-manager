"use server";

import { createClient } from "@/utils/supabase/server";

// ==========================================
// AI FINANCIAL ADVISOR (Lógica Local Avançada)
// ==========================================

export async function getFinancialAdvice() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  
  // 1. Buscar transações do mês
  const { data: transactions } = await supabase
    .from("transacoes")
    .select("descricao, valor, categoria, tipo")
    .gte("data", startOfMonth);

  // 2. Buscar saldo atual (Contas Corrente)
  const { data: contas } = await supabase
    .from("contas_bancarias")
    .select("saldo_atual, tipo_conta"); // Assumindo que possa ter um campo tipo, senão usamos nome

  const saldoEmConta = contas?.reduce((acc, c) => acc + c.saldo_atual, 0) || 0;

  // 3. Processamento de Dados
  const expensesByCategory: Record<string, number> = {};
  let totalSpent = 0;
  let subscriptionsTotal = 0;
  
  // Palavras-chave de assinaturas comuns
  const subKeywords = ["netflix", "spotify", "amazon", "prime", "disney", "hbo", "globo", "youtube", "apple", "adobe", "chatgpt", "midjourney"];

  transactions?.filter(t => t.tipo === 'Saída').forEach(t => {
      // Agrupamento por categoria
      expensesByCategory[t.categoria] = (expensesByCategory[t.categoria] || 0) + t.valor;
      totalSpent += t.valor;

      // Detecção de assinaturas
      if (subKeywords.some(k => t.descricao.toLowerCase().includes(k))) {
          subscriptionsTotal += t.valor;
      }
  });

  const topCategories = Object.entries(expensesByCategory)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, val]) => ({ category: cat, value: val }));

  // 4. Geração de Insights Dinâmicos
  const advice = [];

  // Insight 1: Maior Categoria de Gastos
  if (topCategories.length > 0 && totalSpent > 0) {
      const top = topCategories[0];
      const percent = (top.value / totalSpent) * 100;
      
      if (percent > 40) { // Se uma categoria consome mais de 40%
          advice.push({
              title: "Alerta de Concentração",
              message: `Atenção! ${percent.toFixed(0)}% dos seus gastos este mês foram em "${top.category}" (R$ ${top.value.toFixed(2)}). Tente diversificar ou reduzir este grupo.`,
              type: "warning"
          });
      } else {
          advice.push({
              title: "Resumo do Mês",
              message: `Sua maior despesa é "${top.category}" (R$ ${top.value.toFixed(2)}), representando ${percent.toFixed(0)}% do total.`,
              type: "info"
          });
      }
  }

  // Insight 2: Assinaturas
  if (subscriptionsTotal > 0) {
      advice.push({
          title: "Raio-X de Assinaturas",
          message: `Identifiquei R$ ${subscriptionsTotal.toFixed(2)} em serviços recorrentes (Netflix, Spotify, etc). Você está usando todos eles?`,
          type: "info"
      });
  }

  // Insight 3: Oportunidade de Investimento (Saldo Parado)
  // Regra: Se tem mais de R$ 3.000 parado em conta corrente
  if (saldoEmConta > 3000) {
      const sugestaoAporte = saldoEmConta * 0.6; // Sugere investir 60% do parado
      advice.push({
          title: "Dinheiro Parado",
          message: `Você tem R$ ${saldoEmConta.toFixed(2)} em conta. Que tal mover R$ ${sugestaoAporte.toFixed(2)} para um investimento com liquidez diária (100% CDI)?`,
          type: "success"
      });
  } else if (saldoEmConta < 0) {
       advice.push({
          title: "Cuidado com o Cheque Especial",
          message: `Sua conta está negativa em R$ ${Math.abs(saldoEmConta).toFixed(2)}. As taxas de juros são altas, priorize cobrir este saldo.`,
          type: "warning"
      });
  }

  // Fallback se não tiver dados suficientes
  if (advice.length === 0) {
      advice.push({
          title: "Iniciando Análise",
          message: "Ainda estou coletando dados sobre seus hábitos. Continue registrando suas transações para receber insights personalizados.",
          type: "info"
      });
  }

  return { success: true, advice };
}
