"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ==========================================
// AÇÕES DE FAMÍLIA (FAMILY MANAGEMENT)
// ==========================================

export async function getFamilyDetails() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  // 1. Obter ID da família do usuário
  const { data: profile } = await supabase
    .from("profiles")
    .select("family_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.family_id) return null;

  // 2. Obter detalhes da família
  const { data: family } = await supabase
    .from("families")
    .select("id, name")
    .eq("id", profile.family_id)
    .single();

  // 3. Obter membros
  const { data: members } = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("family_id", profile.family_id);

  return {
    family,
    members: members || [],
    currentUserRole: profile.role
  };
}

const JoinFamilySchema = z.object({
  familyId: z.string().uuid("Código de família inválido (deve ser um UUID)."),
});

export async function joinFamily(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Sessão expirada." };

  const familyId = formData.get("familyId") as string;
  
  const parsed = JoinFamilySchema.safeParse({ familyId });
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  // Verificar se a família existe
  const { data: familyExists } = await supabase
    .from("families")
    .select("id")
    .eq("id", familyId)
    .single();

  if (!familyExists) {
    return { error: "Família não encontrada. Verifique o código." };
  }

  // Atualizar perfil do usuário
  const { error } = await supabase
    .from("profiles")
    .update({ family_id: familyId, role: 'member' }) // Entra como membro
    .eq("id", user.id);

  if (error) return { error: "Erro ao entrar na família: " + error.message };

  revalidatePath("/configuracoes");
  return { success: true };
}

export async function createNewFamily(formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return { error: "Sessão expirada." };
  
    const name = formData.get("familyName") as string || "Nova Família";
  
    // 1. Criar nova família
    const { data: newFamily, error: famError } = await supabase
      .from("families")
      .insert([{ name }])
      .select()
      .single();
  
    if (famError) return { error: famError.message };
  
    // 2. Mover usuário para ela
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ family_id: newFamily.id, role: 'admin' })
      .eq("id", user.id);
  
    if (profileError) return { error: profileError.message };
  
    revalidatePath("/configuracoes");
    return { success: true };
  }
