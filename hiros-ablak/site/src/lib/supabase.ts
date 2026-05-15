import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Minimal Supabase client for SERVER-SIDE reads against RLS-protected public views.
 *
 * Env vars (provide in Vercel + .env.local):
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * We intentionally use the anon key here. The database must enforce security via
 * RLS on the underlying tables and GRANTs/RLS on the public view(s).
 */
export function getSupabaseServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY env vars.",
    )
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

