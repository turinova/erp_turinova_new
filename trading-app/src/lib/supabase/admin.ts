import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Service role kliens a cron végponthoz — RLS-t megkerülő, teljes jogú
 * hozzáférés, ezért CSAK szerver oldalon, secret-tel védett route-ból
 * használható. A kulcs: Supabase dashboard → Project Settings → API keys
 * → service_role (secret).
 */
export function createSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) {
    throw new Error("Hiányzó SUPABASE_SECRET_KEY vagy NEXT_PUBLIC_SUPABASE_URL env")
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
