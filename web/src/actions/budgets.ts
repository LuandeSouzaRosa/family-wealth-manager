"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath, unstable_cache } from "next/cache";
import { OrcamentoSchema } from "@/lib/schemas";
import { CACHE_TAGS, invalidateTag } from "@/lib/cache";

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

const getCachedOrcamentoStatus = unstable_cache(
  async (userId: string) => {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("vw_orcamento_status")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      console.error("Erro ao buscar status do orçamento:", error);
      return [];
    }

    return data.map((item: any) => ({
      categoria: item.categoria,
      gasto_atual: item.gasto_atual,
      limite: item.limite,
      percentual: item.limite > 0 ? (item.gasto_atual / item.limite) * 100 : 0,
    }));
  },
  ["orcamento-status"],
  { revalidate: 60, tags: [CACHE_TAGS.dashboard] }
);

export async function getOrcamentoStatus() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  return getCachedOrcamentoStatus(user.id);
}

const getCached503020Metrics = unstable_cache(
  async (userId: string) => {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("vw_503020_analysis")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      console.error("Erro ao buscar métricas 50/30/20:", error);
      return [];
    }
    return data;
  },
  ["503020-metrics"],
  { revalidate: 60, tags: [CACHE_TAGS.dashboard] }
);

export async function get503020Metrics() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  return getCached503020Metrics(user.id);
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
  invalidateTag(CACHE_TAGS.dashboard);
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
  invalidateTag(CACHE_TAGS.dashboard);
  return { success: true };
}
