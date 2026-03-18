"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { TransactionSchema, SplitTransactionSchema, IdSchema } from "@/lib/schemas";
import { z } from "zod";
import { CACHE_TAGS, invalidateTag } from "@/lib/cache";

// ==========================================
// TRANSAÇÕES
// ==========================================

export async function createTransaction(formData: FormData) {
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
    console.error("Erro de validação:", parsed.error.format());
    return { error: "Campos inválidos. Verifique os dados inseridos." };
  }

  // 3. Inserir no Banco 
  // O Supabase preenche automaticamente o user_id baseado na sessão SSR ativa.
  const { error } = await supabase
    .from("transacoes")
    .insert([
      {
        ...parsed.data,
        data: parsed.data.data?.toISOString(),
        origem: "Manual",
        user_id: user.id,
      }
    ]);

  if (error) {
    console.error("Erro ao inserir transação:", error);
    return { error: error.message };
  }

  revalidatePath("/transacoes");
  invalidateTag(CACHE_TAGS.dashboard);
  return { success: true };
}

// ==========================================
// SPLIT TRANSACTION (P3.12)
// ==========================================

export async function createSplitTransaction(formData: FormData) {
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
    console.error("Erro de validação split:", parsed.error.format());
    return { error: "Campos inválidos. Verifique os valores do split." };
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
    console.error("Erro ao inserir split:", error);
    return { error: error.message };
  }

  revalidatePath("/transacoes");
  invalidateTag(CACHE_TAGS.dashboard);
  return { success: true };
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

  if (tx?.split_group_id) {
    // Delete entire split group
    const { error } = await supabase
      .from("transacoes")
      .delete()
      .eq("split_group_id", tx.split_group_id)
      .eq("user_id", user.id);

    if (error) return { error: error.message };
  } else {
    // Normal single delete
    const { error } = await supabase
      .from("transacoes")
      .delete()
      .match({ id, user_id: user.id });

    if (error) return { error: error.message };
  }

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

  if (error) return { error: error.message };
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
    console.error("Erro ao buscar transações recentes:", error);
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
    
  if (month && year) {
     // Configurar range de data para o mês específico
     // no Postgres extrair month é possível mas filtrar via JS range na string ISO é mais verboso
     // Vamos usar range start e end 
     const startDate = new Date(year, month - 1, 1).toISOString();
     const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();
     query = query.gte("data", startDate).lte("data", endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao buscar transações:", error);
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
          if (error) return { error: error.message };
          
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

  if (error) {
    console.error("Erro na importação em lote:", error);
    return { error: error.message };
  }

  revalidatePath("/transacoes");
  invalidateTag(CACHE_TAGS.dashboard);
  return { success: true, count: validTransactions.length, skipped: 0 };
}
