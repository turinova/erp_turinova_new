import type { SupabaseClient } from '@supabase/supabase-js'

function newSessionNonce(): string {
  return globalThis.crypto.randomUUID()
}

export async function registerAppSession(
  supabase: SupabaseClient,
  input: {
    userId: string
    tenantId?: string | null
    userAgent?: string | null
    ip?: string | null
  }
): Promise<string> {
  const sessionNonce = newSessionNonce()

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

/** Más user sessionjének érvénytelenítése (remove / disable / jogváltozás). */
export async function revokeAppSessionForUser(userId: string): Promise<void> {
  try {
    const { createServiceClient } = await import('@/lib/supabase/service')
    const admin = createServiceClient()
    if (!admin) return
    await clearAppSession(admin, userId)
  } catch (err) {
    console.error('revokeAppSessionForUser', err)
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
  const result = await checkAppSession(supabase, userId, nonce)
  return result.ok
}

export type AppSessionCheck =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'nonce_missing'
        | 'nonce_mismatch'
        | 'session_row_missing'
        | 'session_check_error'
    }

/** Részletes session check — middleware kick reason-höz. */
export async function checkAppSession(
  supabase: SupabaseClient,
  userId: string,
  nonce: string | undefined | null
): Promise<AppSessionCheck> {
  if (!nonce) return { ok: false, reason: 'nonce_missing' }

  const { data, error } = await supabase
    .from('app_user_sessions')
    .select('session_nonce')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('checkAppSession', error.message)
    return { ok: false, reason: 'session_check_error' }
  }

  if (!data) return { ok: false, reason: 'session_row_missing' }
  if (data.session_nonce !== nonce) {
    return { ok: false, reason: 'nonce_mismatch' }
  }
  return { ok: true }
}

export function parseForwardedIp(forwarded: string | null): string | null {
  if (!forwarded) return null
  const first = forwarded.split(',')[0]?.trim()
  if (!first) return null
  if (!/^[\d.:a-fA-F]+$/.test(first)) return null
  return first.slice(0, 64)
}
