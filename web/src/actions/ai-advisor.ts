"use server";

import { createClient } from "@/utils/supabase/server";
import { getOrcamentoStatus } from "@/actions/budgets";
import { handleError, logInfo } from "@/lib/logger";

// ==========================================
// AI FINANCIAL ADVISOR (V1 Comparativo P3.13)
// ==========================================

import { generateInsights } from '@/lib/ai-advisor-logic';

export async function getFinancialAdvice(responsavel: string = "Todos") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const today = new Date();
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  
  const { data: transactions, error: tError } = await supabase
    .from("transacoes")
    .select("descricao, valor, categoria, tipo, data, responsavel")
    .eq("user_id", user.id)
    .eq("tipo", "Saída")
    .gte("data", previousMonthStart.toISOString());

  if (tError) {
    handleError({ action: "getFinancialAdvice_transactions", userId: user.id }, tError);
  }

  const orcamentos = await getOrcamentoStatus();

  const { data: contas, error: cError } = await supabase
    .from("contas_bancarias")
    .select("saldo_atual")
    .eq("user_id", user.id);
  
  if (cError) {
    handleError({ action: "getFinancialAdvice_contas", userId: user.id }, cError);
  }

  const saldoEmConta = contas?.reduce((acc, c) => acc + Number(c.saldo_atual), 0) || 0;

  logInfo({ action: "getFinancialAdvice", userId: user.id }, `Advisor rodou com ${transactions?.length || 0} txs.`);

  return generateInsights(transactions || [], orcamentos[responsavel] || [], saldoEmConta, currentMonthStart, previousMonthStart, responsavel);
}
