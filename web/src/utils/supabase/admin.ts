import "server-only";
import { createClient } from "@supabase/supabase-js";
import { type Database } from "@/types/database";

/**
 * Admin Supabase client using SERVICE_ROLE_KEY.
 * Bypasses RLS — use ONLY in server-side contexts (webhooks, cron).
 * NEVER expose this to the client.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase admin credentials");
  }

  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
