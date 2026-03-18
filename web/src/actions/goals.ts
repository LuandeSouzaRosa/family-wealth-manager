"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { MetaSchema, IdSchema } from "@/lib/schemas";
import { CACHE_TAGS, invalidateTag } from "@/lib/cache";

// ==========================================
// METAS (Goals)
// ==========================================

export async function getMetas() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("metas")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar metas:", error);
    return [];
  }
  return data;
}

export async function createMeta(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Sessão expirada." };

  const data = {
    nome: formData.get("nome") as string,
    valor_alvo: parseFloat(formData.get("valor_alvo") as string),
    valor_atual: parseFloat(formData.get("valor_atual") as string) || 0,
    data_limite: formData.get("data_limite") as string || null,
    cor: formData.get("cor") as string || "#10b981",
  };

  const parsed = MetaSchema.safeParse(data);
  if (!parsed.success) return { error: "Campos inválidos." };

  const { error } = await supabase
    .from("metas")
    .insert([{ 
      ...parsed.data, 
      data_limite: parsed.data.data_limite?.toISOString() || null,
      user_id: user.id 
    }]);

  if (error) return { error: error.message };

  revalidatePath("/metas");
  invalidateTag(CACHE_TAGS.dashboard);
  return { success: true };
}

export async function updateMeta(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const data = {
    nome: formData.get("nome") as string,
    valor_alvo: parseFloat(formData.get("valor_alvo") as string),
    valor_atual: parseFloat(formData.get("valor_atual") as string),
    data_limite: formData.get("data_limite") as string || null,
    cor: formData.get("cor") as string,
  };

  const parsed = MetaSchema.safeParse(data);
  if (!parsed.success) return { error: "Campos inválidos." };

  const { error } = await supabase
    .from("metas")
    .update({ 
      ...parsed.data, 
      data_limite: parsed.data.data_limite?.toISOString() || null
    })
    .match({ id, user_id: user.id });

  if (error) return { error: error.message };
  
  revalidatePath("/metas");
  invalidateTag(CACHE_TAGS.dashboard);
  return { success: true };
}

export async function deleteMeta(id: string) {
  const parsed = IdSchema.safeParse(id);
  if (!parsed.success) return { error: "ID inválido." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const { error } = await supabase
    .from("metas")
    .delete()
    .match({ id, user_id: user.id });

  if (error) return { error: error.message };
  revalidatePath("/metas");
  invalidateTag(CACHE_TAGS.dashboard);
  return { success: true };
}
