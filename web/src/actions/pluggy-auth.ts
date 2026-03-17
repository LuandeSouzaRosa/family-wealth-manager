"use server";

import { createClient } from "@/utils/supabase/server";
import { PluggyClient } from "pluggy-sdk";

// ==========================================
// PLUGGY AUTH SERVER ACTIONS
// ==========================================

export async function createPluggyConnectToken() {
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

      // Gera um token de conexão único para este usuário
      // O webhookUrl é onde a Pluggy vai avisar sobre novas transações
      const connectToken = await client.createConnectToken(undefined, {
          webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/pluggy`,
          clientUserId: user.id,
      } as any);

      return { accessToken: connectToken.accessToken };
  } catch (error: any) {
      console.error("Erro ao criar token Pluggy:", error);
      return { error: "Falha ao conectar com o banco." };
  }
}
