import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseUrl } from "@/lib/supabase/env"

/**
 * Service-role kliens — KIZÁRÓLAG szerveroldali, publikus (token-alapú)
 * végpontokhoz. RLS-t megkerüli, ezért minden lekérdezést tokennel kell
 * szűkíteni, és a válaszból ki kell szűrni az access_code-ot.
 */
export function createSupabaseServiceClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) {
    throw new Error("Hiányzik a SUPABASE_SERVICE_ROLE_KEY (.env.local) — a publikus linkekhez kötelező.")
  }
  return createClient(getSupabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function isServiceRoleConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}
