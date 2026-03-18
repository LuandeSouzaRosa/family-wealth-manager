"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { handleError, logInfo } from "@/lib/logger";
import { PluggyClient } from "pluggy-sdk";
import { revalidatePath } from "next/cache";
import { CACHE_TAGS, invalidateTag } from "@/lib/cache";

// ==========================================
// PLUGGY SYNC SERVER ACTIONS
// ==========================================

const CATEGORY_MAP: Record<string, string> = {
  "Restaurants": "Alimentação",
  "Food & Groceries": "Alimentação",
  "Groceries": "Alimentação",
  "Fast Food": "Alimentação",
  "Bars & Coffee Shops": "Alimentação",
  "Bakeries": "Alimentação",
  "Transport": "Transporte",
  "Gas Stations": "Transporte",
  "Ride Sharing": "Transporte",
  "Parking": "Transporte",
  "Tolls": "Transporte",
  "Public Transit": "Transporte",
  "Health": "Saúde",
  "Medicine": "Saúde",
  "Dentists": "Saúde",
  "Doctors": "Saúde",
  "Gyms & Fitness": "Saúde",
  "Entertainment": "Lazer",
  "Sports": "Lazer",
  "Movies & Music": "Lazer",
  "Games": "Lazer",
  "Streaming Services": "Assinaturas",
  "Subscriptions": "Assinaturas",
  "Education": "Educação",
  "Books & Newspapers": "Educação",
  "Courses": "Educação",
  "Rent": "Moradia",
  "Housing": "Moradia",
  "Home Maintenance": "Moradia",
  "Utilities": "Moradia",
  "Insurance": "Moradia",
  "Shopping": "Compras",
  "Clothing": "Compras",
  "Electronics": "Compras",
  "Personal Care": "Compras",
  "Pets": "Compras",
  "Professional Services": "Serviços",
  "Government & Taxes": "Impostos",
  "Taxes & Charges": "Impostos",
  "Donations": "Outros",
  "Transfers": "Outros",
  "Salary": "Salário",
  "Income": "Salário",
  "Investments": "Investimento",
};

/**
 * Maps a Pluggy category to our FWM category.
 */
function mapCategory(pluggyCategory: string | null): string {
  if (!pluggyCategory) return "Outros";
  return CATEGORY_MAP[pluggyCategory] || "Outros";
}

/**
 * Determines if a Pluggy transaction is "Entrada" or "Saída".
 * In Pluggy, positive amounts = credit (Entrada), negative = debit (Saída).
 */
function mapTransactionType(amount: number): "Entrada" | "Saída" {
  return amount >= 0 ? "Entrada" : "Saída";
}

/**
 * Returns a configured PluggyClient instance.
 */
function getPluggyClient(): PluggyClient {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing PLUGGY_CLIENT_ID or PLUGGY_CLIENT_SECRET");
  }

  return new PluggyClient({ clientId, clientSecret });
}

// ==========================================
// SAVE CONNECTION (After Pluggy Connect)
// ==========================================

export async function savePluggyConnection(
  pluggyItemId: string,
  connectorName: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  try {
    const client = getPluggyClient();

    // Get accounts from the connected item
    const accounts = await client.fetchAccounts(pluggyItemId);
    const primaryAccount = accounts.results?.[0];

    // Upsert the connection
    const { error } = await supabase.from("pluggy_connections").upsert(
      {
        user_id: user.id,
        pluggy_item_id: pluggyItemId,
        pluggy_account_id: primaryAccount?.id || null,
        connector_name: connectorName,
        status: "active",
        last_sync_at: new Date().toISOString(),
      },
      { onConflict: "pluggy_item_id" }
    );

    if (error) {
      return handleError({ action: "createPluggyItem", userId: user.id }, error);
    }

    logInfo({ action: "createPluggyItem", userId: user.id }, "Conexão bancária criada com sucesso.");
    return { success: true, accountId: primaryAccount?.id };
  } catch (err: any) {
    return handleError({ action: "createPluggyItem", userId: user.id }, err, "Erro ao buscar contas da Pluggy externa.");
  }
}

// ==========================================
// SYNC TRANSACTIONS (Initial + Manual)
// ==========================================

export async function syncPluggyTransactions(pluggyItemId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  try {
    const client = getPluggyClient();

    // Get all accounts for this item
    const accounts = await client.fetchAccounts(pluggyItemId);

    let totalInserted = 0;
    let totalSkipped = 0;

    for (const account of accounts.results || []) {
      // Fetch transactions for each account (last 90 days)
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 90);

      const transactions = await client.fetchTransactions(account.id, {
        from: fromDate.toISOString().split("T")[0],
      });

      if (!transactions.results || transactions.results.length === 0) continue;

      // Process each transaction
      for (const tx of transactions.results) {
        const amount = Math.abs(tx.amount);
        const tipo = mapTransactionType(tx.amount);
        const categoria = mapCategory(tx.category || null);

        // Try to insert (dedup by pluggy_transaction_id)
        const { error: insertError } = await supabase
          .from("transacoes")
          .upsert(
            {
              descricao: tx.description || "Transação Pluggy",
              valor: amount,
              categoria,
              tipo,
              data: tx.date ? new Date(tx.date).toISOString() : new Date().toISOString(),
              responsavel: "Casal",
              origem: "Pluggy",
              pluggy_transaction_id: tx.id,
              user_id: user.id,
            },
            { onConflict: "pluggy_transaction_id", ignoreDuplicates: true }
          );

        if (insertError) {
          // Skip duplicates silently
          if (insertError.code === "23505") {
            totalSkipped++;
            continue;
          }
          handleError({ action: "syncPluggyTransactions_insert", userId: user.id }, insertError);
        } else {
          totalInserted++;
        }
      }

      // Also update local account balance if linked
      const { data: connection } = await supabase
        .from("pluggy_connections")
        .select("conta_bancaria_id")
        .eq("pluggy_item_id", pluggyItemId)
        .single();

      if (connection?.conta_bancaria_id && account.balance != null) {
        await supabase
          .from("contas_bancarias")
          .update({ saldo_atual: account.balance })
          .eq("id", connection.conta_bancaria_id);
      }
    }

    // Update last_sync timestamp
    await supabase
      .from("pluggy_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("pluggy_item_id", pluggyItemId);

    revalidatePath("/transacoes");
    revalidatePath("/contas");
    invalidateTag(CACHE_TAGS.dashboard);

    logInfo({ action: "syncPluggyTransactions", userId: user.id }, `Sincronização manual: ${totalInserted} inseridas, ${totalSkipped} puladas.`);
    return { success: true, inserted: totalInserted, skipped: totalSkipped };
  } catch (err: any) {
    return handleError({ action: "syncPluggyTransactions", userId: user.id }, err, "Falha na sincronização transacional Pluggy externa.");
  }
}

// ==========================================
// WEBHOOK SYNC (Called from API route — uses admin client)
// ==========================================

export async function syncFromWebhook(
  pluggyItemId: string,
  accountId: string,
  createdTransactionsLink?: string
) {
  const supabase = createAdminClient();

  try {
    // 1. Find the connection to get the user_id
    const { data: connection, error: connError } = await supabase
      .from("pluggy_connections")
      .select("user_id, conta_bancaria_id")
      .eq("pluggy_item_id", pluggyItemId)
      .single();

    if (connError || !connection) {
      handleError({ action: "syncFromWebhook_connection" }, connError || new Error(`Connection not found for itemId: ${pluggyItemId}`));
      return { error: "Connection not found" };
    }

    const userId = connection.user_id;
    const client = getPluggyClient();

    // 2. Fetch new transactions (via SDK since we have the accountId)
    const transactions = await client.fetchTransactions(accountId);

    let inserted = 0;
    let skipped = 0;

    for (const tx of transactions.results || []) {
      const amount = Math.abs(tx.amount);
      const tipo = mapTransactionType(tx.amount);
      const categoria = mapCategory(tx.category || null);

      const { error: insertError } = await supabase
        .from("transacoes")
        .upsert(
          {
            descricao: tx.description || "Transação Pluggy",
            valor: amount,
            categoria,
            tipo,
            data: tx.date ? new Date(tx.date).toISOString() : new Date().toISOString(),
            responsavel: "Casal",
            origem: "Pluggy",
            pluggy_transaction_id: tx.id,
            user_id: userId,
          },
          { onConflict: "pluggy_transaction_id", ignoreDuplicates: true }
        );

      if (insertError && insertError.code !== "23505") {
        handleError({ action: "syncFromWebhook_insert", userId }, insertError);
      } else if (!insertError) {
        inserted++;
      } else {
        skipped++;
      }
    }

    // 3. Update account balance
    try {
      const account = await client.fetchAccount(accountId);
      if (connection.conta_bancaria_id && account.balance != null) {
        await supabase
          .from("contas_bancarias")
          .update({ saldo_atual: account.balance })
          .eq("id", connection.conta_bancaria_id);
      }
    } catch {
      // Non-critical: balance update failed
    }

    // 4. Update last_sync timestamp
    await supabase
      .from("pluggy_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("pluggy_item_id", pluggyItemId);

    logInfo({ action: "syncFromWebhook", userId }, `[Pluggy Webhook] Synced: ${inserted} inserted, ${skipped} skipped`);
    return { success: true, inserted, skipped };
  } catch (err: any) {
    return handleError({ action: "syncFromWebhook" }, err, "Falha de processamento no Webhook da Pluggy.");
  }
}

// ==========================================
// LIST USER CONNECTIONS
// ==========================================

export async function getPluggyConnections() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pluggy_connections")
    .select("*, contas_bancarias:conta_bancaria_id(nome)")
    .order("created_at", { ascending: false });

  if (error) {
    handleError({ action: "getPluggyConnections" }, error);
    return [];
  }

  return data;
}

// ==========================================
// LINK CONNECTION TO LOCAL BANK ACCOUNT
// ==========================================

export async function linkPluggyToAccount(
  connectionId: string,
  contaBancariaId: string
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("pluggy_connections")
    .update({ conta_bancaria_id: contaBancariaId })
    .eq("id", connectionId);

  if (error) return handleError({ action: "linkPluggyToAccount" }, error);
  return { success: true };
}

// ==========================================
// MANUAL RE-SYNC
// ==========================================

export async function manualResync(connectionId: string) {
  const supabase = await createClient();

  const { data: connection } = await supabase
    .from("pluggy_connections")
    .select("pluggy_item_id")
    .eq("id", connectionId)
    .single();

  if (!connection) return { error: "Conexão não encontrada." };

  return syncPluggyTransactions(connection.pluggy_item_id);
}

// ==========================================
// DELETE CONNECTION
// ==========================================

export async function deletePluggyConnection(connectionId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("pluggy_connections")
    .delete()
    .eq("id", connectionId);

  if (error) return { error: error.message };

  revalidatePath("/contas");
  return { success: true };
}
