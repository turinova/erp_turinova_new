import { cookies } from 'next/headers'

import { CURRENT_TENANT_COOKIE } from '@/lib/auth/config'
import type { SupabaseClient } from '@supabase/supabase-js'

export type KeresoAuthOk = {
  tenantId: string
  isPartnerSearch: boolean
  userId: string
}

export type KeresoAuthResult =
  | { ok: true; auth: KeresoAuthOk; authMs: number }
  | { ok: false; status: 401 | 403; error: string; authMs: number }

/**
 * Lean kereső auth — 1× getUser + 1 keskeny profile/membership query.
 * Nincs entitlements / page_access / full session bundle.
 */
export async function resolveKeresoAuth(
  supabase: SupabaseClient,
  fromPartnerUi: boolean
): Promise<KeresoAuthResult> {
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

  if (fromPartnerUi) {
    const { data: profile } = await supabase
      .from('partner_profiles')
      .select('selected_tenant_id, status')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile || profile.status === 'disabled') {
      return {
        ok: false,
        status: 401,
        error: 'Unauthorized',
        authMs: Math.round(performance.now() - t0)
      }
    }

    if (!profile.selected_tenant_id) {
      return {
        ok: false,
        status: 403,
        error: 'Nincs kiválasztott cég.',
        authMs: Math.round(performance.now() - t0)
      }
    }

    return {
      ok: true,
      auth: {
        tenantId: profile.selected_tenant_id as string,
        isPartnerSearch: true,
        userId: user.id
      },
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
      .limit(1)
      .maybeSingle()

    if (membership) {
      return {
        ok: true,
        auth: {
          tenantId: preferredTenantId,
          isPartnerSearch: false,
          userId: user.id
        },
        authMs: Math.round(performance.now() - t0)
      }
    }
  }

  const { data: anyMembership } = await supabase
    .from('tenant_memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (anyMembership?.tenant_id) {
    return {
      ok: true,
      auth: {
        tenantId: anyMembership.tenant_id as string,
        isPartnerSearch: false,
        userId: user.id
      },
      authMs: Math.round(performance.now() - t0)
    }
  }

  // Staff host, de partner-only session (path-mode) — fallback
  const { data: profile } = await supabase
    .from('partner_profiles')
    .select('selected_tenant_id, status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (
    profile &&
    profile.status !== 'disabled' &&
    profile.selected_tenant_id
  ) {
    return {
      ok: true,
      auth: {
        tenantId: profile.selected_tenant_id as string,
        isPartnerSearch: true,
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
