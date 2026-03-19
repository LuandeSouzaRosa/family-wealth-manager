"use server"

import { createClient } from "@/utils/supabase/server";
import { CandidateTransaction } from "@/lib/reconciliation-logic";
import { handleError } from "@/lib/logger";

export async function getReconciliationCandidates(startDateStr: string, endDateStr: string): Promise<CandidateTransaction[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  // Ampliar janela de busca para +/- 7 dias
  const start = new Date(startDateStr);
  start.setDate(start.getDate() - 7);
  
  const end = new Date(endDateStr);
  end.setDate(end.getDate() + 7);

  const { data: transactions, error } = await supabase
    .from("transacoes")
    .select("id, descricao, valor, data, tipo, conta_id, split_group_id")
    .eq("user_id", user.id)
    .gte("data", start.toISOString())
    .lte("data", end.toISOString())
    .in("status", ["Realizado", "Agendado"]); // Permite conciliar contas pendentes e efetivadas

  if (error) {
    handleError({ action: "getReconciliationCandidates", userId: user.id }, error);
    return [];
  }

  if (!transactions) return [];

  const candidates: CandidateTransaction[] = [];
  const splitsMap = new Map<string, CandidateTransaction>();

  for (const t of transactions) {
    if (t.split_group_id) {
      if (!splitsMap.has(t.split_group_id)) {
        // Inicializa o grupo de Split com a data e descricao da primeira fatia encontrada
        splitsMap.set(t.split_group_id, {
          id: t.id, // Id arbitrário da primeira fatia (irrelevante para conciliação central)
          descricao: t.descricao, // Herdando da fatia pai (Costuma ser idêntico em Splits)
          valor: t.valor,
          data: t.data,
          tipo: t.tipo as "Entrada" | "Saída" | "Transferência",
          conta_id: t.conta_id,
          split_group_id: t.split_group_id,
          is_split_group: true
        });
      } else {
        // Acumula o valor total do Split!
        const group = splitsMap.get(t.split_group_id)!;
        group.valor += t.valor;
      }
    } else {
      // Manual/Simples
      candidates.push({
        id: t.id,
        descricao: t.descricao,
        valor: t.valor,
        data: t.data,
        tipo: t.tipo as "Entrada" | "Saída" | "Transferência",
        conta_id: t.conta_id,
      });
    }
  }

  // Acoplar os splits agrupados na resposta final
  splitsMap.forEach(group => {
    // Garantir que não existam casas decimais quebradas no acúmulo financeiro do Javascript (Ex: 0.1 + 0.2 = 0.300000000004)
    group.valor = parseFloat(group.valor.toFixed(2));
    candidates.push(group);
  });

  return candidates;
}
