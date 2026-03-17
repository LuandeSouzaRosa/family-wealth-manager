"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { IdSchema } from "@/lib/schemas";

// ==========================================
// CATEGORIAS DINÂMICAS (Dynamic Categories)
// ==========================================

export async function getCategorias() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categorias")
    .select("*")
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao buscar categorias:", error);
    return [];
  }
  return data;
}

export async function createCategoria(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const data = {
    nome: formData.get("nome") as string,
    tipo: formData.get("tipo") as string || "Saída",
    cor: formData.get("cor") as string || "#64748b",
    icone: formData.get("icone") as string || "tag",
  };

  const { error } = await supabase
    .from("categorias")
    .insert([{ ...data, user_id: user.id }]);

  if (error) {
    if (error.code === '23505') return { error: "Já existe uma categoria com este nome." };
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

export async function deleteCategoria(id: string) {
  const parsed = IdSchema.safeParse(id);
  if (!parsed.success) return { error: "ID inválido." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const { error } = await supabase
    .from("categorias")
    .delete()
    .match({ id, user_id: user.id });

  if (error) return { error: error.message };
  revalidatePath("/");
  return { success: true };
}

// ==========================================
// CATEGORIZAÇÃO (Rules)
// ==========================================

export async function getCategorizationRules() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("regras_categorizacao")
    .select("*");

  if (error) {
    console.error("Erro ao buscar regras de categorização:", error);
    return [];
  }
  return data;
}

export async function createCategorizationRule(texto: string, categoria: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Sessão expirada." };

  const { error } = await supabase
    .from("regras_categorizacao")
    .insert([{ 
        texto_contem: texto, 
        categoria_destino: categoria,
        user_id: user.id 
    }]);

  if (error) return { error: error.message };
  return { success: true };
}
