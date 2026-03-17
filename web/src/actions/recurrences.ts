"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { RecorrenteSchema, IdSchema } from "@/lib/schemas";

// ==========================================
// RECORRENTES (Recurring Expenses)
// ==========================================

export async function getRecorrentes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recorrentes")
    .select("*")
    .order("dia_vencimento", { ascending: true });

  if (error) {
    console.error("Erro ao buscar recorrentes:", error);
    return [];
  }
  return data;
}

export async function createRecorrente(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Sessão expirada." };

  const data = {
    descricao: formData.get("descricao") as string,
    valor: parseFloat(formData.get("valor") as string),
    categoria: formData.get("categoria") as string,
    tipo: formData.get("tipo") as "Entrada" | "Saída",
    dia_vencimento: parseInt(formData.get("dia_vencimento") as string, 10),
    frequencia: formData.get("frequencia") as "Mensal" | "Semanal" | "Anual" | "Quinzenal" || "Mensal",
    responsavel: formData.get("responsavel") as string || "Casal",
  };

  const parsed = RecorrenteSchema.safeParse(data);
  if (!parsed.success) return { error: "Dashboard: Campos inválidos." };

  const { error } = await supabase
    .from("recorrentes")
    .insert([{ ...parsed.data, user_id: user.id, ativo: true }]);

  if (error) return { error: error.message };

  // =================================================================================
  // INTEGRAÇÃO INTELIGENTE: CRIAR REGRA DE CATEGORIZAÇÃO AUTOMÁTICA
  // =================================================================================
  // Se eu criei uma conta fixa chamada "Netflix", provavelmente quero que tudo que 
  // venha do banco com "Netflix" vá para a mesma categoria.
  try {
      const termo = parsed.data.descricao.split(" ")[0]; // Pega a primeira palavra (Ex: "Aluguel" de "Aluguel Apto")
      if (termo.length > 3) {
          // Verifica se já existe regra
          const { data: regraExiste } = await supabase
              .from("regras_categorizacao")
              .select("id")
              .ilike("texto_contem", `%${termo}%`)
              .single();
          
          if (!regraExiste) {
              await supabase.from("regras_categorizacao").insert([{
                  texto_contem: termo,
                  categoria_destino: parsed.data.categoria,
                  user_id: user.id
              }]);
          }
      }
  } catch (err) {
      console.error("Erro silencioso ao criar regra automática:", err);
      // Não falha a criação da recorrência por isso
  }

  revalidatePath("/recorrentes");
  return { success: true };
}

export async function toggleRecorrente(id: string, currentStatus: boolean) {
  const parsed = IdSchema.safeParse(id);
  if (!parsed.success) return { error: "ID inválido." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const { error } = await supabase
    .from("recorrentes")
    .update({ ativo: !currentStatus })
    .match({ id, user_id: user.id });

  if (error) return { error: error.message };
  revalidatePath("/recorrentes");
  return { success: true };
}

export async function deleteRecorrente(id: string) {
  const parsed = IdSchema.safeParse(id);
  if (!parsed.success) return { error: "ID inválido." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const { error } = await supabase
    .from("recorrentes")
    .delete()
    .match({ id, user_id: user.id });

  if (error) return { error: error.message };
  revalidatePath("/recorrentes");
  return { success: true };
}

export async function processarRecorrencias() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  // 1. Buscar todas recorrentes ativas
  const { data: recorrentes } = await supabase
    .from("recorrentes")
    .select("*")
    .eq("ativo", true);

  if (!recorrentes || recorrentes.length === 0) {
    return { success: true, message: "Nenhuma recorrência ativa." };
  }

  // 2. Data atual para referência
  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();
  let gerados = 0;

  // 3. Iterar e gerar transações
  // (Otimização: idealmente fazer em batch, mas loop simples é mais seguro para lógica de data)
  for (const item of recorrentes) {
    // Verificar se já existe transação gerada para este mês/ano vinda desta recorrência
    // Como não temos ID de origem na transação, vamos usar uma heurística:
    // "Existe transação com mesma descrição, valor e categoria neste mês?"
    // (Melhoria futura: adicionar coluna 'origem_recorrente_id' na tabela transacoes)
    
    const dataVencimento = new Date(anoAtual, mesAtual, item.dia_vencimento);
    const dataInicioBusca = new Date(anoAtual, mesAtual, 1).toISOString();
    const dataFimBusca = new Date(anoAtual, mesAtual + 1, 0).toISOString();

    const { data: existentes } = await supabase
      .from("transacoes")
      .select("id")
      .eq("descricao", item.descricao)
      .eq("valor", item.valor)
      .gte("data", dataInicioBusca)
      .lte("data", dataFimBusca);

    if (existentes && existentes.length > 0) {
      continue; // Já foi gerado este mês
    }

    // Gerar nova transação
    await supabase.from("transacoes").insert([{
      descricao: item.descricao,
      valor: item.valor,
      categoria: item.categoria,
      tipo: item.tipo,
      data: dataVencimento.toISOString(),
      responsavel: item.responsavel,
      origem: "Recorrente", // Flag para identificar
      user_id: user.id
    }]);

    // Atualizar ultima_geracao
    await supabase.from("recorrentes").update({ ultima_geracao: new Date().toISOString() }).eq("id", item.id);
    gerados++;
  }

  revalidatePath("/");
  revalidatePath("/transacoes");
  return { success: true, message: `${gerados} transações geradas.` };
}
