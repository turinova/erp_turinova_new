import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function registerAppSession(
  supabase: SupabaseClient,
  input: {
    userId: string
    tenantId?: string | null
    userAgent?: string | null
    ip?: string | null
  }
): Promise<string> {
  const sessionNonce = randomUUID()

  const { error } = await supabase.from('app_user_sessions').upsert(
    {
      user_id: input.userId,
      session_nonce: sessionNonce,
      tenant_id: input.tenantId ?? null,
      user_agent: input.userAgent?.slice(0, 500) ?? null,
      ip: input.ip || null,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    console.error('registerAppSession', error.message)
    throw new Error('Munkamenet regisztráció sikertelen.')
  }

  return sessionNonce
}

export async function clearAppSession(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('app_user_sessions')
    .delete()
    .eq('user_id', userId)
  if (error) {
    console.error('clearAppSession', error.message)
  }
}

/**
 * true = a cookie nonce egyezik az egyetlen aktív sessionnel.
 * Nincs DB sor → false (újra be kell lépni).
 */
export async function isAppSessionValid(
  supabase: SupabaseClient,
  userId: string,
  nonce: string | undefined | null
): Promise<boolean> {
  if (!nonce) return false

  const { data, error } = await supabase
    .from('app_user_sessions')
    .select('session_nonce')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('isAppSessionValid', error.message)
    return false
  }

  if (!data) return false
  return data.session_nonce === nonce
}

export function parseForwardedIp(forwarded: string | null): string | null {
  if (!forwarded) return null
  const first = forwarded.split(',')[0]?.trim()
  if (!first) return null
  if (!/^[\d.:a-fA-F]+$/.test(first)) return null
  return first.slice(0, 64)
}
