"use server";

import { getDeleteMatchCriteria } from '@/lib/transactions-logic';
import { handleError } from "@/lib/logger";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { TransactionSchema, SplitTransactionSchema, IdSchema } from "@/lib/schemas";
import { z } from "zod";
import { CACHE_TAGS, invalidateTag } from "@/lib/cache";

// ==========================================
// TRANSAÇÕES
// ==========================================

export async function createTransaction(formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { error: "Sessão expirada. Faça login novamente." };
    }

    // 1. Extrair
    const data = {
      descricao: formData.get("descricao") as string,
      valor: parseFloat(formData.get("valor") as string),
      categoria: formData.get("categoria") as string,
      tipo: formData.get("tipo") as "Entrada" | "Saída" | "Transferência",
      data: formData.get("data") as string || new Date().toISOString(),
      responsavel: formData.get("responsavel") as string || "Casal",
      conta_id: formData.get("conta_id") as string || null,
      cartao_id: formData.get("cartao_id") as string || null,
      status: (formData.get("status") as "Realizado" | "Agendado" | "Pendente") || "Realizado",
    };

    // 2. Validar
    const parsed = TransactionSchema.safeParse(data);
    if (!parsed.success) {
      return handleError({ action: "createTransaction", userId: user.id }, parsed.error, "Campos inválidos. Verifique os dados inseridos.");
    }

    // 3. Inserir no Banco 
    const finalPayload = {
      ...parsed.data,
      data: parsed.data.data?.toISOString(),
      origem: "Manual",
      user_id: user.id,
    };

    const { error } = await supabase
      .from("transacoes")
      .insert([finalPayload]);

    if (error) {
      return handleError({ action: "createTransaction", userId: user.id }, error);
    }

    revalidatePath("/transacoes");
    invalidateTag(CACHE_TAGS.dashboard);
    return { success: true };
  } catch (err) {
    return handleError({ action: "createTransaction" }, err, "Ocorreu uma falha no servidor ao processar a criação manual.");
  }
}

// ==========================================
// SPLIT TRANSACTION (P3.12)
// ==========================================

export async function createSplitTransaction(formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Sessão expirada. Faça login novamente." };

    // Parse splits from FormData
    const splitsRaw: { responsavel: string; valor: number }[] = [];
    let i = 0;
    while (formData.get(`splits[${i}].responsavel`)) {
      splitsRaw.push({
        responsavel: formData.get(`splits[${i}].responsavel`) as string,
        valor: parseFloat(formData.get(`splits[${i}].valor`) as string),
      });
      i++;
    }

    const data = {
      descricao: formData.get("descricao") as string,
      valor_total: parseFloat(formData.get("valor") as string),
      categoria: formData.get("categoria") as string,
      tipo: formData.get("tipo") as "Entrada" | "Saída" | "Transferência",
      data: formData.get("data") as string || new Date().toISOString(),
      conta_id: formData.get("conta_id") as string || null,
      cartao_id: formData.get("cartao_id") as string || null,
      status: (formData.get("status") as "Realizado" | "Agendado" | "Pendente") || "Realizado",
      splits: splitsRaw,
    };

    const parsed = SplitTransactionSchema.safeParse(data);
    if (!parsed.success) {
      return handleError({ action: "createSplitTransaction", userId: user.id }, parsed.error, "Campos inválidos. Verifique os valores do split.");
    }

    const splitGroupId = crypto.randomUUID();
    const rows = parsed.data.splits.map((split) => ({
      descricao: parsed.data.descricao,
      valor: split.valor,
      categoria: parsed.data.categoria,
      tipo: parsed.data.tipo,
      data: parsed.data.data?.toISOString() || new Date().toISOString(),
      conta_id: parsed.data.conta_id,
      cartao_id: parsed.data.cartao_id,
      status: parsed.data.status || "Realizado",
      responsavel: split.responsavel,
      origem: "Manual",
      user_id: user.id,
      split_group_id: splitGroupId,
    }));

    const { error } = await supabase.from("transacoes").insert(rows);

    if (error) {
      return handleError({ action: "createSplitTransaction", userId: user.id }, error);
    }

    revalidatePath("/transacoes");
    invalidateTag(CACHE_TAGS.dashboard);
    return { success: true };
  } catch (err) {
    return handleError({ action: "createSplitTransaction" }, err, "Ocorreu uma falha no servidor ao processar o split manual.");
  }
}

export async function deleteTransaction(id: string) {
  const parsed = IdSchema.safeParse(id);
  if (!parsed.success) return { error: "ID inválido." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  // Check if this transaction is part of a split group
  const { data: tx } = await supabase
    .from("transacoes")
    .select("split_group_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  const criteria = getDeleteMatchCriteria(tx, id, user.id);

  const { error } = await supabase
    .from("transacoes")
    .delete()
    .match(criteria.match);

  if (error) return handleError({ action: "deleteTransaction", userId: user.id }, error);

  revalidatePath("/transacoes");
  invalidateTag(CACHE_TAGS.dashboard);
  return { success: true };
}

export async function updateTransaction(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const data = {
    descricao: formData.get("descricao") as string,
    valor: parseFloat(formData.get("valor") as string),
    categoria: formData.get("categoria") as string,
    tipo: formData.get("tipo") as "Entrada" | "Saída" | "Transferência",
    data: formData.get("data") as string || new Date().toISOString(),
    responsavel: formData.get("responsavel") as string || "Casal",
    conta_id: formData.get("conta_id") as string || null,
    cartao_id: formData.get("cartao_id") as string || null,
  };

  const parsed = TransactionSchema.safeParse(data);
  if (!parsed.success) return { error: "Campos inválidos." };

  const { error } = await supabase
    .from("transacoes")
    .update({ 
      ...parsed.data,
      data: parsed.data.data?.toISOString() // Garantir string ISO
    })
    .match({ id, user_id: user.id });

  if (error) return handleError({ action: "updateTransaction", userId: user.id }, error);
  revalidatePath("/transacoes");
  invalidateTag(CACHE_TAGS.dashboard);
  return { success: true };
}

export async function getRecentTransactions(limit = 5) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transacoes")
    .select("id, descricao, valor, categoria, tipo, data")
    .order("data", { ascending: false })
    .limit(limit);

  if (error) {
    handleError({ action: "getRecentTransactions" }, error);
    return [];
  }

  return data;
}

export async function getTransactions(month?: number, year?: number) {
  const supabase = await createClient();
  
  let query = supabase
    .from("transacoes")
    .select("*")
    .order("data", { ascending: false });
    
  if (year && year > 0) {
     if (month && month > 0) {
        // Range do mês específico
        const startDate = new Date(year, month - 1, 1).toISOString();
        const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();
        query = query.gte("data", startDate).lte("data", endDate);
     } else {
        // Range do ano inteiro (month === 0)
        const startDate = new Date(year, 0, 1).toISOString();
        const endDate = new Date(year, 11, 31, 23, 59, 59).toISOString();
        query = query.gte("data", startDate).lte("data", endDate);
     }
  }

  const { data, error } = await query;

  if (error) {
    handleError({ action: "getTransactions" }, error);
    return [];
  }

  return data;
}

export async function createTransactionsBatch(transactions: any[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Sessão expirada." };

  // Validar e formatar cada transação
  const validTransactions = transactions.map(t => {
    // Permite descrições mais longas para o Ajuste Automático
    const schema = t.descricao.includes("Saldo Inicial") 
        ? TransactionSchema.extend({ descricao: z.string() }) 
        : TransactionSchema;

    const parsed = schema.safeParse(t);
    if (!parsed.success) return null;
    return {
      ...parsed.data,
      data: parsed.data.data?.toISOString() || new Date().toISOString(),
      origem: t.descricao.includes("Saldo Inicial") ? "Sistema" : "Importação",
      user_id: user.id
    };
  }).filter(Boolean);

  if (validTransactions.length === 0) {
    return { error: "Nenhuma transação válida encontrada." };
  }

  // 1. Verificar se há um ajuste de saldo novo no lote
  const novoAjuste = validTransactions.find(t => t.descricao.includes("Saldo Inicial Acumulado"));

  if (novoAjuste) {
      // 2. Apagar ajustes anteriores para evitar duplicação
      await supabase
          .from("transacoes")
          .delete()
          .ilike("descricao", "%Saldo Inicial Acumulado%")
          .eq("user_id", user.id);
  }

  // 3. Verificação de Duplicatas e CONCILIAÇÃO DE RECORRÊNCIAS
  // Estratégia: Buscar transações existentes (Realizadas) e Agendadas (Recorrências)
  if (validTransactions.length > 0) {
      // Encontrar range de datas
      const dates = validTransactions.map(t => new Date(t.data!).getTime());
      const minDate = new Date(Math.min(...dates) - 86400000 * 5).toISOString(); // -5 dias de margem
      const maxDate = new Date(Math.max(...dates) + 86400000 * 5).toISOString(); // +5 dias de margem

      // Buscar existentes neste período (Realizadas e Agendadas)
      const { data: existing } = await supabase
          .from("transacoes")
          .select("id, descricao, valor, data, conta_id, status, origem")
          .gte("data", minDate)
          .lte("data", maxDate);

      const toInsert: any[] = [];
      const toDeleteIds: string[] = []; // IDs de agendamentos para remover (conciliados)
      
      // Assinaturas de transações JÁ REALIZADAS para evitar duplicidade de importação
      const realizedSignatures = new Set(existing?.filter(t => t.status !== 'Agendado').map(t => {
           const d = new Date(t.data).toISOString().split('T')[0];
           const v = t.valor.toFixed(2);
           const desc = t.descricao.substring(0, 15).toLowerCase();
           const c = t.conta_id || 'null';
           return `${d}|${v}|${desc}|${c}`;
      }));

      // Agendamentos disponíveis para conciliação
      let availableScheduled = existing?.filter(t => t.status === 'Agendado') || [];

      for (const t of validTransactions) {
           const d = new Date(t.data!).toISOString().split('T')[0];
           const v = t.valor.toFixed(2);
           const desc = t.descricao.substring(0, 15).toLowerCase();
           const c = t.conta_id || 'null';
           const key = `${d}|${v}|${desc}|${c}`;

           // 1. Se já existe realizada, pula (Duplicata Exata)
           if (realizedSignatures.has(key)) {
               continue;
           }

           // 2. Tentar conciliar com Agendado (Match Inteligente)
           // Critério: Mesmo valor (ou muito próximo), mesma categoria (opcional), data próxima (+- 5 dias)
           const matchIndex = availableScheduled.findIndex(scheduled => {
               const sDate = new Date(scheduled.data).getTime();
               const tDate = new Date(t.data!).getTime();
               const diffDays = Math.abs(sDate - tDate) / (1000 * 60 * 60 * 24);
               
               // Match por valor exato OU descrição muito parecida
               const valorMatch = Math.abs(scheduled.valor - t.valor) < 0.05; // diferença de centavos
               const descMatch = t.descricao.toLowerCase().includes(scheduled.descricao.toLowerCase()) || 
                                 scheduled.descricao.toLowerCase().includes(t.descricao.toLowerCase());

               return diffDays <= 5 && (valorMatch || descMatch);
           });

           if (matchIndex >= 0) {
               // CONCILIAÇÃO ENCONTRADA!
               // Removemos o agendamento (será substituído pela importação real)
               toDeleteIds.push(availableScheduled[matchIndex].id);
               // Removemos da lista de disponíveis para não casar duas vezes
               availableScheduled.splice(matchIndex, 1);
           }

           // Adiciona a transação importada (agora como Realizada)
           toInsert.push(t);
      }

      // Executar operações
      if (toDeleteIds.length > 0) {
          await supabase.from("transacoes").delete().in("id", toDeleteIds);
      }

      if (toInsert.length > 0) {
          const { error } = await supabase.from("transacoes").insert(toInsert);
          if (error) return handleError({ action: "createTransactionsBatch", userId: user.id }, error);
          
          revalidatePath("/transacoes");
          invalidateTag(CACHE_TAGS.dashboard);
          return { 
              success: true, 
              count: toInsert.length, 
              conciliated: toDeleteIds.length,
              skipped: validTransactions.length - toInsert.length 
          };
      } else {
          return { success: true, count: 0, skipped: validTransactions.length, message: "Nenhuma transação nova." };
      }
  }

  // Se não houver existentes ou falhar a busca, segue fluxo normal (inserir todas)
  const { error } = await supabase
    .from("transacoes")
    .insert(validTransactions);

  if (error) return handleError({ action: "createTransactionsBatch", userId: user.id }, error);

  revalidatePath("/transacoes");
  invalidateTag(CACHE_TAGS.dashboard);
  return { success: true, count: validTransactions.length, skipped: 0 };
}

export interface ReconciliationPayload {
  inserts: any[];
  conciliations: { candidateId: string; conta_id: string | null; isSplitGroup?: boolean }[];
}

export async function processReconciliationBatch(payload: ReconciliationPayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  // 1. Inserir "Novos" usando a lógica validada
  let insertedCount = 0;
  if (payload.inserts.length > 0) {
    const validTransactions = payload.inserts.map(t => {
      const schema = t.descricao.includes("Saldo Inicial") 
          ? TransactionSchema.extend({ descricao: z.string() }) 
          : TransactionSchema;
      const parsed = schema.safeParse(t);
      if (!parsed.success) return null;
      return {
        ...parsed.data,
        data: parsed.data.data?.toISOString() || new Date().toISOString(),
        origem: t.descricao.includes("Saldo Inicial") ? "Sistema" : "Importação",
        user_id: user.id
      };
    }).filter(Boolean);

    if (validTransactions.length > 0) {
      // Deletar Ajuste de Saldo Antigo se existir novo
      const novoAjuste = validTransactions.find(t => t.descricao.includes("Saldo Inicial Acumulado"));
      if (novoAjuste) {
          await supabase
              .from("transacoes")
              .delete()
              .ilike("descricao", "%Saldo Inicial Acumulado%")
              .eq("user_id", user.id);
      }

      const { error } = await supabase.from("transacoes").insert(validTransactions);
      if (error) return handleError({ action: "processReconciliationBatch_insert", userId: user.id }, error);
      insertedCount = validTransactions.length;
    }
  }

  // 2. Efetivar Conciliações
  let conciliatedCount = 0;
  for (const conc of payload.conciliations) {
    if (!conc.conta_id) continue;

    const matchCondition = conc.isSplitGroup 
        ? { split_group_id: conc.candidateId, user_id: user.id } 
        : { id: conc.candidateId, user_id: user.id };

    // ATENÇÃO: Conforme regra estrita do usuário, NÃO alteramos a "origem" de Manual para Importado.
    // O mero preenchimento/sobreposição do conta_id garante que a despesa Manual encontrou suas costas no Banco, sem quebrar os relatórios.
    // O status muda para "Realizado" para consolidar transações que estavam como "Agendadas" projetando budget no futuro.
    const { error } = await supabase
      .from("transacoes")
      .update({ conta_id: conc.conta_id, status: "Realizado" })
      .match(matchCondition);

    if (!error) {
      conciliatedCount++;
    } else {
      console.error("Erro na conciliação do Candidato:", conc.candidateId, error);
    }
  }

  revalidatePath("/transacoes");
  invalidateTag(CACHE_TAGS.dashboard);
  
  return { success: true, count: insertedCount, conciliated: conciliatedCount };
}

// ==========================================
// MÓDULO RÁPIDO (REVISÃO CSV)
// ==========================================

export async function quickEditTransaction(id: string, categoria: string, responsavel: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Sem sessão." }

  const { error } = await supabase
    .from("transacoes")
    .update({ categoria, responsavel })
    .eq("id", id)

  if (error) {
    handleError({ action: "quickEditTransaction", userId: user.id }, error)
    return { error: "Erro ao atualizar metadados da transação." }
  }
  
  revalidatePath("/transacoes")
  invalidateTag(CACHE_TAGS.dashboard)
  return { success: true }
}
