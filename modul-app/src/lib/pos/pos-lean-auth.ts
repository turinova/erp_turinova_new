import { cookies } from 'next/headers'

import { CURRENT_TENANT_COOKIE } from '@/lib/auth/config'
import type { SupabaseClient } from '@supabase/supabase-js'

export type PosLeanAuthOk = {
  tenantId: string
  userId: string
}

export type PosLeanAuthResult =
  | { ok: true; auth: PosLeanAuthOk; authMs: number }
  | { ok: false; status: 401 | 403; error: string; authMs: number }

/**
 * Lean POS auth — getUser + tenant membership only.
 * Nincs entitlements / page_access / partner fallback (POS staff-only).
 */
export async function resolvePosLeanAuth(
  supabase: SupabaseClient
): Promise<PosLeanAuthResult> {
  const t0 = performance.now()

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized',
      authMs: Math.round(performance.now() - t0)
    }
  }

  const cookieStore = await cookies()
  const preferredTenantId =
    cookieStore.get(CURRENT_TENANT_COOKIE)?.value ?? null

  if (preferredTenantId) {
    const { data: membership } = await supabase
      .from('tenant_memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('tenant_id', preferredTenantId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (membership) {
      return {
        ok: true,
        auth: { tenantId: preferredTenantId, userId: user.id },
        authMs: Math.round(performance.now() - t0)
      }
    }
  }

  const { data: anyMembership } = await supabase
    .from('tenant_memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (anyMembership?.tenant_id) {
    return {
      ok: true,
      auth: {
        tenantId: anyMembership.tenant_id as string,
        userId: user.id
      },
      authMs: Math.round(performance.now() - t0)
    }
  }

  return {
    ok: false,
    status: 401,
    error: 'Unauthorized',
    authMs: Math.round(performance.now() - t0)
  }
}
