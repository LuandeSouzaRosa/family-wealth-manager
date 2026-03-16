"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { InvestimentoSchema } from "@/lib/schemas";

// ==========================================
// INVESTIMENTOS (XP, etc.)
// ==========================================

export async function getInvestimentos() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investimentos")
    .select("*")
    .eq("ativo", true)
    .order("valor_atual", { ascending: false });

  if (error) {
    console.error("Erro ao buscar investimentos:", error);
    return [];
  }
  return data;
}

export async function createInvestimento(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const data = {
    nome: formData.get("nome") as string,
    tipo: formData.get("tipo") as string,
    instituicao: formData.get("instituicao") as string || "XP",
    valor_aplicado: parseFloat(formData.get("valor_aplicado") as string),
    valor_atual: parseFloat(formData.get("valor_atual") as string),
    quantidade: parseFloat(formData.get("quantidade") as string) || 1,
    data_aplicacao: formData.get("data_aplicacao") as string || new Date().toISOString(),
    data_vencimento: formData.get("data_vencimento") ? (formData.get("data_vencimento") as string) : null,
    liquidez: formData.get("liquidez") as string,
    responsavel: formData.get("responsavel") as string || "Casal",
  };

  const parsed = InvestimentoSchema.safeParse(data);
  if (!parsed.success) return { error: "Campos inválidos." };

  const { error } = await supabase
    .from("investimentos")
    .insert([{ 
      ...parsed.data, 
      data_aplicacao: parsed.data.data_aplicacao?.toISOString(),
      data_vencimento: parsed.data.data_vencimento?.toISOString() || null,
      user_id: user.id, 
      ativo: true 
    }]);

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/investimentos");
  return { success: true };
}

export async function updateInvestimento(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  // Atualização simples (geralmente usada para atualizar saldo ou detalhes)
  const data: any = {};
  if (formData.get("valor_atual")) data.valor_atual = parseFloat(formData.get("valor_atual") as string);
  if (formData.get("quantidade")) data.quantidade = parseFloat(formData.get("quantidade") as string);
  if (formData.get("nome")) data.nome = formData.get("nome") as string;

  const { error } = await supabase
    .from("investimentos")
    .update(data)
    .match({ id, user_id: user.id });

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/investimentos");
  return { success: true };
}

export async function deleteInvestimento(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("investimentos")
    .delete()
    .match({ id });

  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/investimentos");
  return { success: true };
}
