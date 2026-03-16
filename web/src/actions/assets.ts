"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { PatrimonioSchema } from "@/lib/schemas";

// ==========================================
// PATRIMÔNIO (Net Worth)
// ==========================================

export async function getPatrimonio() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patrimonio")
    .select("*")
    .order("valor", { ascending: false });

  if (error) {
    console.error("Erro ao buscar patrimônio:", error);
    return [];
  }
  return data;
}

export async function createPatrimonio(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Sessão expirada." };

  const data = {
    item: formData.get("item") as string,
    valor: parseFloat(formData.get("valor") as string),
    tipo: formData.get("tipo") as "Ativo" | "Passivo",
    categoria: formData.get("categoria") as string,
    responsavel: formData.get("responsavel") as string || "Casal",
  };

  const parsed = PatrimonioSchema.safeParse(data);
  if (!parsed.success) return { error: "Campos inválidos." };

  const { error } = await supabase
    .from("patrimonio")
    .insert([{ 
      ...parsed.data, 
      user_id: user.id,
      data_atualizacao: new Date().toISOString()
    }]);

  if (error) return { error: error.message };

  revalidatePath("/patrimonio");
  return { success: true };
}

export async function deletePatrimonio(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("patrimonio")
    .delete()
    .match({ id });

  if (error) return { error: error.message };
  revalidatePath("/patrimonio");
  return { success: true };
}
