"use server";

import { createClient } from "@/utils/supabase/server";
import { PluggyClient } from "pluggy-sdk";

// ==========================================
// PLUGGY AUTH SERVER ACTIONS
// ==========================================

export async function createPluggyConnectToken(clientOrigin?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
      console.error("Faltam variáveis de ambiente da Pluggy.");
      return { error: "Erro de configuração no servidor." };
  }

  try {
      const client = new PluggyClient({
          clientId,
          clientSecret,
      });

      // Garante uma URL válida mesmo se a env var faltar na Vercel
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || clientOrigin || "https://familywealthmanager.vercel.app";
      const webhookUrl = `${baseUrl}/api/webhooks/pluggy`;

      const connectToken = await client.createConnectToken(undefined, {
          webhookUrl,
          clientUserId: user.id,
      } as any);

      return { accessToken: connectToken.accessToken };
  } catch (error: any) {
      console.error("Erro ao criar token Pluggy:", error);
      return { error: "Falha ao conectar com o banco." };
  }
}
