"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { OrcamentoSchema } from "@/lib/schemas";

// ==========================================
// ORÇAMENTOS (Budgets)
// ==========================================

export async function getOrcamentos() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orcamentos")
    .select("*")
    .order("valor_limite", { ascending: false });

  if (error) {
    console.error("Erro ao buscar orçamentos:", error);
    return [];
  }
  return data;
}

export async function getOrcamentoStatus() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vw_orcamento_status")
    .select("*");

  if (error) {
    console.error("Erro ao buscar status do orçamento:", error);
    return [];
  }
  
  // Mapper para garantir compatibilidade com componentes de UI
  return data.map((item: any) => ({
    categoria: item.categoria,
    gasto_atual: item.gasto_atual,
    limite: item.limite,
    percentual: item.limite > 0 ? (item.gasto_atual / item.limite) * 100 : 0
  }));
}

export async function get503020Metrics() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vw_503020_analysis")
    .select("*");

  if (error) {
    console.error("Erro ao buscar métricas 50/30/20:", error);
    return [];
  }
  return data;
}

export async function createOrcamento(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Sessão expirada." };

  const data = {
    categoria: formData.get("categoria") as string,
    limite: parseFloat(formData.get("limite_mensal") as string), // Frontend envia 'limite_mensal', mapeamos para 'limite'
    responsavel: formData.get("responsavel") as string || "Casal",
  };

  const parsed = OrcamentoSchema.safeParse(data);
  if (!parsed.success) return { error: "Campos inválidos." };

  const { error } = await supabase
    .from("orcamentos")
    .insert([{ ...parsed.data, user_id: user.id }]);

  if (error) {
    if (error.code === '23505') { // Unique violation
      return { error: "Já existe um orçamento definido para esta categoria." };
    }
    return { error: error.message };
  }

  revalidatePath("/orcamentos");
  return { success: true };
}

export async function deleteOrcamento(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("orcamentos")
    .delete()
    .match({ id });

  if (error) return { error: error.message };
  revalidatePath("/orcamentos");
  return { success: true };
}
