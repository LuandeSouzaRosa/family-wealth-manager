"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { ContaSchema, CartaoSchema, IdSchema } from "@/lib/schemas";

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
  
  revalidatePath("/");
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

async function calcularFaturaAtual(supabase: any, cartao: any) {
  const hoje = new Date();
  const diaAtual = hoje.getDate();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  let dataInicio, dataFim;

  if (diaAtual < cartao.dia_fechamento) {
    // Fatura aberta: fechou mês passado até dia de fechamento deste mês
    const dataFimAnterior = getClampedDate(anoAtual, mesAtual - 1, cartao.dia_fechamento);
    dataInicio = new Date(dataFimAnterior);
    dataInicio.setDate(dataInicio.getDate() + 1);
    dataInicio.setHours(0, 0, 0, 0);

    dataFim = getClampedDate(anoAtual, mesAtual, cartao.dia_fechamento);
    dataFim.setHours(23, 59, 59, 999);
  } else {
    // Fatura aberta: fechou este mês até dia de fechamento do próximo
    const dataFimEsteMes = getClampedDate(anoAtual, mesAtual, cartao.dia_fechamento);
    dataInicio = new Date(dataFimEsteMes);
    dataInicio.setDate(dataInicio.getDate() + 1);
    dataInicio.setHours(0, 0, 0, 0);

    dataFim = getClampedDate(anoAtual, mesAtual + 1, cartao.dia_fechamento);
    dataFim.setHours(23, 59, 59, 999);
  }

  // Vencimento: se dia_vencimento < dia_fechamento, o vencimento é no mês seguinte ao fechamento
  let mesVencimento = dataFim.getMonth();
  let anoVencimento = dataFim.getFullYear();

  if (cartao.dia_vencimento < cartao.dia_fechamento) {
    mesVencimento += 1;
  }

  const dataVencimento = getClampedDate(anoVencimento, mesVencimento, cartao.dia_vencimento);
  dataVencimento.setHours(23, 59, 59, 999);

  // Buscar transações vinculadas a este cartão neste período
  const { data: transacoes } = await supabase
      .from("transacoes")
      .select("valor")
      .eq("cartao_id", cartao.id)
      .eq("tipo", "Saída") // Apenas gastos
      .gte("data", dataInicio.toISOString())
      .lte("data", dataFim.toISOString());

  const total = transacoes?.reduce((acc: number, t: any) => acc + t.valor, 0) || 0;
  
  return {
      valor: total,
      vencimento: dataVencimento.toISOString(),
      fechamento: dataFim.toISOString(),
      status: "Aberta"
  };
}

export async function getCartoesCredito() {
  const supabase = await createClient();
  
  // Buscar cartões
  const { data: cartoes, error } = await supabase
    .from("cartoes_credito")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    // Se a tabela não existir (ainda não migrada), retorna vazio sem erro
    if (error.code === '42P01') return [];
    console.error("Erro ao buscar cartões:", error);
    return [];
  }

  // Para cada cartão, calcular fatura atual
  const cartoesComFatura = await Promise.all(cartoes.map(async (cartao) => {
      const fatura = await calcularFaturaAtual(supabase, cartao);
      return { ...cartao, fatura_atual: fatura };
  }));

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
  
  revalidatePath("/");
  revalidatePath("/cartoes");
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
