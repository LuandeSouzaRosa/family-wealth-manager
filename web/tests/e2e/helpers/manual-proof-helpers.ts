import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env "${name}" for E2E persistence validation.`);
  }
  return value;
}

export function buildUniqueDescription(prefix: string) {
  const nonce = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${nonce}`;
}

export async function createAuthenticatedSupabaseClient() {
  const url = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  const client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const email = getRequiredEnv('TEST_EMAIL');
  const password = getRequiredEnv('TEST_PASSWORD');
  const { error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(`Supabase auth failed for persistence validation: ${error.message}`);
  }

  return client;
}

export async function countManualPersistedByDescription(
  client: SupabaseClient,
  descricao: string,
) {
  const { count, error } = await client
    .from('transacoes')
    .select('id', { count: 'exact', head: true })
    .eq('descricao', descricao)
    .eq('origem', 'Manual');

  if (error) throw error;
  return count ?? 0;
}

export async function cleanupTransactionsByDescription(
  client: SupabaseClient,
  descricao: string,
) {
  const { error } = await client.from('transacoes').delete().eq('descricao', descricao);
  if (error) throw error;
}
