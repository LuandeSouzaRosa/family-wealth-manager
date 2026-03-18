"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { ContaSchema, CartaoSchema, IdSchema } from "@/lib/schemas";
import { CACHE_TAGS, invalidateTag } from "@/lib/cache";

// ==========================================
// CONTAS BANCÁRIAS (Múltiplas Contas)
// ==========================================

export async function getContasBancarias() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contas_bancarias")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao buscar contas:", error);
    return [];
  }
  return data;
}

export async function createContaBancaria(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const data = {
    nome: formData.get("nome") as string,
    instituicao: formData.get("instituicao") as string,
    saldo_atual: parseFloat(formData.get("saldo_atual") as string) || 0,
    responsavel: formData.get("responsavel") as string || "Todos",
    cor: formData.get("cor") as string || "#10b981",
  };

  const parsed = ContaSchema.safeParse(data);
  if (!parsed.success) return { error: "Campos inválidos." };

  const { error } = await supabase
    .from("contas_bancarias")
    .insert([{ ...parsed.data, user_id: user.id }]);

  if (error) return { error: error.message };
  
  revalidatePath("/contas");
  invalidateTag(CACHE_TAGS.dashboard);
  return { success: true };
}

// ==========================================
// CARTÕES DE CRÉDITO (Credit Cards)
// ==========================================

/**
 * Retorna uma data segura respeitando o limite de dias do mês.
 * Ex: 31 de Abril retorna 30 de Abril.
 */
function getClampedDate(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

/**
 * Calcula o período de fatura aberta de um cartão (pure function, sem DB).
 * Retorna { dataInicio, dataFim, dataVencimento }.
 */
function calcularPeriodoFatura(cartao: { dia_fechamento: number; dia_vencimento: number }) {
  const hoje = new Date();
  const diaAtual = hoje.getDate();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  let dataInicio: Date, dataFim: Date;

  if (diaAtual < cartao.dia_fechamento) {
    const dataFimAnterior = getClampedDate(anoAtual, mesAtual - 1, cartao.dia_fechamento);
    dataInicio = new Date(dataFimAnterior);
    dataInicio.setDate(dataInicio.getDate() + 1);
    dataInicio.setHours(0, 0, 0, 0);

    dataFim = getClampedDate(anoAtual, mesAtual, cartao.dia_fechamento);
    dataFim.setHours(23, 59, 59, 999);
  } else {
    const dataFimEsteMes = getClampedDate(anoAtual, mesAtual, cartao.dia_fechamento);
    dataInicio = new Date(dataFimEsteMes);
    dataInicio.setDate(dataInicio.getDate() + 1);
    dataInicio.setHours(0, 0, 0, 0);

    dataFim = getClampedDate(anoAtual, mesAtual + 1, cartao.dia_fechamento);
    dataFim.setHours(23, 59, 59, 999);
  }

  let mesVencimento = dataFim.getMonth();
  const anoVencimento = dataFim.getFullYear();

  if (cartao.dia_vencimento < cartao.dia_fechamento) {
    mesVencimento += 1;
  }

  const dataVencimento = getClampedDate(anoVencimento, mesVencimento, cartao.dia_vencimento);
  dataVencimento.setHours(23, 59, 59, 999);

  return { dataInicio, dataFim, dataVencimento };
}

export async function getCartoesCredito() {
  const supabase = await createClient();

  // Query 1: Buscar todos os cartões
  const { data: cartoes, error } = await supabase
    .from("cartoes_credito")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    if (error.code === '42P01') return [];
    console.error("Erro ao buscar cartões:", error);
    return [];
  }

  if (!cartoes || cartoes.length === 0) return [];

  // Calcular período de fatura de cada cartão (puro, sem DB)
  const periodos = cartoes.map((cartao) => ({
    cartao,
    ...calcularPeriodoFatura(cartao),
  }));

  // Encontrar a janela de datas mais ampla para cobrir todos os cartões
  const minDate = new Date(
    Math.min(...periodos.map((p) => p.dataInicio.getTime()))
  );
  const maxDate = new Date(
    Math.max(...periodos.map((p) => p.dataFim.getTime()))
  );

  // Query 2: Buscar TODAS as transações de TODOS os cartões em uma única query
  const cartaoIds = cartoes.map((c) => c.id);
  const { data: todasTransacoes } = await supabase
    .from("transacoes")
    .select("cartao_id, valor, data")
    .in("cartao_id", cartaoIds)
    .eq("tipo", "Saída")
    .gte("data", minDate.toISOString())
    .lte("data", maxDate.toISOString());

  // Agrupar transações por cartao_id para lookup rápido
  const txPorCartao = new Map<string, Array<{ valor: number; data: string }>>();
  for (const tx of todasTransacoes || []) {
    if (!tx.cartao_id) continue;
    if (!txPorCartao.has(tx.cartao_id)) {
      txPorCartao.set(tx.cartao_id, []);
    }
    txPorCartao.get(tx.cartao_id)!.push(tx);
  }

  // Calcular fatura de cada cartão filtrando pelo período específico em memória
  const cartoesComFatura = periodos.map(({ cartao, dataInicio, dataFim, dataVencimento }) => {
    const transacoesCartao = txPorCartao.get(cartao.id) || [];

    // Filtrar transações dentro do período de fatura deste cartão específico
    const inicioMs = dataInicio.getTime();
    const fimMs = dataFim.getTime();

    const total = transacoesCartao.reduce((acc, tx) => {
      const txMs = new Date(tx.data).getTime();
      return (txMs >= inicioMs && txMs <= fimMs) ? acc + tx.valor : acc;
    }, 0);

    return {
      ...cartao,
      fatura_atual: {
        valor: total,
        vencimento: dataVencimento.toISOString(),
        fechamento: dataFim.toISOString(),
        status: "Aberta" as const,
      },
    };
  });

  return cartoesComFatura;
}

export async function createCartaoCredito(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const data = {
    nome: formData.get("nome") as string,
    limite: parseFloat(formData.get("limite") as string),
    dia_fechamento: parseInt(formData.get("dia_fechamento") as string),
    dia_vencimento: parseInt(formData.get("dia_vencimento") as string),
    responsavel: formData.get("responsavel") as string || "Todos",
    cor: formData.get("cor") as string || "#000000",
  };

  const parsed = CartaoSchema.safeParse(data);
  if (!parsed.success) return { error: "Campos inválidos." };

  const { error } = await supabase
    .from("cartoes_credito")
    .insert([{ ...parsed.data, user_id: user.id }]);

  if (error) return { error: error.message };
  
  revalidatePath("/cartoes");
  invalidateTag(CACHE_TAGS.dashboard);
  return { success: true };
}

export async function deleteCartaoCredito(id: string) {
  const parsed = IdSchema.safeParse(id);
  if (!parsed.success) return { error: "ID inválido." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const { error } = await supabase
    .from("cartoes_credito")
    .delete()
    .match({ id, user_id: user.id });

  if (error) return { error: error.message };
  revalidatePath("/cartoes");
  return { success: true };
}
