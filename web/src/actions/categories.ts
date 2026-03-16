"use server";

import { createClient } from "@/utils/supabase/server";

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
