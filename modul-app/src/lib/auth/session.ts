import { cookies } from 'next/headers'

import {
  CURRENT_TENANT_COOKIE,
  DEV_SESSION_COOKIE,
  getDemoCompanyName,
  isDevBypassEnabled,
  isSupabaseConfigured
} from '@/lib/auth/config'
import { ALL_PAGE_KEYS } from '@/lib/permissions/pages'
import { listAllowedPageKeys } from '@/lib/permissions/access'
import {
  intersectPages,
  listTenantEntitledPageKeys
} from '@/lib/platform/entitlements'
import { createClient } from '@/lib/supabase/server'
import type { TenantRole } from '@/lib/supabase/database.types'
import {
  listMembershipsForUser,
  resolveCurrentTenant,
  TENANT_ROLE_LABELS
} from '@/lib/tenancy/memberships'

export type SessionUser = {
  id: string
  email: string
  companyName: string
  tenantId: string | null
  tenantSlug: string | null
  membershipId: string | null
  role: TenantRole | null
  roleLabel: string | null
  hasMembership: boolean
  isDevSession: boolean
  /** Tenant csomag + add-on effektív oldalai. */
  entitledPages: string[]
  /** User page_access ∩ entitledPages. */
  allowedPages: string[]
  canManageUsers: boolean
  isPlatformAdmin: boolean
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    if (!supabase) return null

    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user?.email) return null

    const cookieStore = await cookies()
    const preferredTenantId =
      cookieStore.get(CURRENT_TENANT_COOKIE)?.value ?? null

    const memberships = await listMembershipsForUser(supabase, user.id)
    const current = resolveCurrentTenant(memberships, preferredTenantId)

    if (
      current &&
      preferredTenantId &&
      preferredTenantId !== current.tenantId
    ) {
      try {
        cookieStore.set(CURRENT_TENANT_COOKIE, current.tenantId, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: process.env.NODE_ENV === 'production'
        })
      } catch {
        // ignore in RSC
      }
    }

    if (!current && preferredTenantId) {
      try {
        cookieStore.delete(CURRENT_TENANT_COOKIE)
      } catch {
        // ignore
      }
    }

    let entitledPages: string[] = ['/home']
    let allowedPages: string[] = ['/home']
    if (current) {
      entitledPages = await listTenantEntitledPageKeys(
        supabase,
        current.tenantId
      )
      // Ha még nincs materializálva (régi tenant migráció előtt), ne zárjuk ki.
      if (entitledPages.length <= 1) {
        const { count } = await supabase
          .from('tenant_entitlements')
          .select('feature_key', { count: 'exact', head: true })
          .eq('tenant_id', current.tenantId)
        if (!count) {
          entitledPages = [...ALL_PAGE_KEYS]
        }
      }

      const membershipPages = await listAllowedPageKeys(
        supabase,
        current.membershipId,
        current.role
      )
      allowedPages = intersectPages(membershipPages, entitledPages)
    }

    const canManageUsers =
      current?.role === 'owner' || current?.role === 'admin'

    let isPlatformAdmin = false
    const { data: platformRow } = await supabase
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .maybeSingle()
    isPlatformAdmin = Boolean(platformRow)

    if (current?.tenantId) {
      const { data: onboarding } = await supabase
        .from('tenant_onboarding')
        .select('first_login_at')
        .eq('tenant_id', current.tenantId)
        .maybeSingle()
      if (onboarding && !onboarding.first_login_at) {
        await supabase
          .from('tenant_onboarding')
          .update({
            first_login_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('tenant_id', current.tenantId)
      } else if (!onboarding) {
        await supabase.from('tenant_onboarding').insert({
          tenant_id: current.tenantId,
          first_login_at: new Date().toISOString()
        })
      }
    }

    return {
      id: user.id,
      email: user.email,
      companyName: current?.tenantName ?? 'Nincs cég hozzárendelve',
      tenantId: current?.tenantId ?? null,
      tenantSlug: current?.tenantSlug ?? null,
      membershipId: current?.membershipId ?? null,
      role: current?.role ?? null,
      roleLabel: current ? TENANT_ROLE_LABELS[current.role] : null,
      hasMembership: Boolean(current),
      isDevSession: false,
      entitledPages,
      allowedPages,
      canManageUsers,
      isPlatformAdmin
    }
  }

  if (isDevBypassEnabled()) {
    const cookieStore = await cookies()
    const raw = cookieStore.get(DEV_SESSION_COOKIE)?.value
    if (!raw) return null

    return {
      id: 'dev-user',
      email: decodeURIComponent(raw),
      companyName: getDemoCompanyName(),
      tenantId: 'dev-tenant',
      tenantSlug: 'demo',
      membershipId: 'dev-membership',
      role: 'owner',
      roleLabel: TENANT_ROLE_LABELS.owner,
      hasMembership: true,
      isDevSession: true,
      entitledPages: [...ALL_PAGE_KEYS],
      allowedPages: [...ALL_PAGE_KEYS],
      canManageUsers: true,
      isPlatformAdmin: true
    }
  }

  return null
}
