import { cookies, headers } from 'next/headers'
import { cache } from 'react'

import {
  APP_SESSION_NONCE_COOKIE,
  CURRENT_TENANT_COOKIE,
  DEV_SESSION_COOKIE,
  IMPERSONATION_SESSION_COOKIE,
  SESSION_SNAPSHOT_COOKIE,
  getDemoCompanyName,
  isDevBypassEnabled,
  isSupabaseConfigured
} from '@/lib/auth/config'
import {
  buildSessionSnapshot,
  sessionSnapshotCookieOptions,
  signSessionSnapshot,
  verifySessionSnapshotToken,
  type SessionSnapshot
} from '@/lib/auth/session-snapshot'
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

export type ImpersonationInfo = {
  sessionId: string
  operatorUserId: string
  operatorEmail: string | null
  targetEmail: string
  tenantId: string | null
  tenantName: string
  expiresAt: string
}

export type SessionUser = {
  id: string
  email: string
  displayName: string | null
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
  impersonation: ImpersonationInfo | null
  /** Diagnosztika: session forrás. */
  sessionSource?: 'snapshot' | 'db' | 'dev'
}

export async function clearSessionSnapshotCookie(): Promise<void> {
  try {
    const cookieStore = await cookies()
    cookieStore.delete(SESSION_SNAPSHOT_COOKIE)
  } catch {
    // ignore RSC
  }
}

export async function setSessionSnapshotCookie(
  snapshot: SessionSnapshot
): Promise<void> {
  try {
    const token = await signSessionSnapshot(snapshot)
    const cookieStore = await cookies()
    cookieStore.set(
      SESSION_SNAPSHOT_COOKIE,
      token,
      sessionSnapshotCookieOptions()
    )
  } catch {
    // ignore RSC / size
  }
}

function sessionUserFromSnapshot(snap: SessionSnapshot): SessionUser {
  return {
    id: snap.sub,
    email: snap.email,
    displayName: snap.displayName ?? null,
    companyName: snap.tenantName || 'Nincs cég hozzárendelve',
    tenantId: snap.tenantId,
    tenantSlug: snap.tenantSlug,
    membershipId: snap.membershipId,
    role: snap.role,
    roleLabel: snap.role ? TENANT_ROLE_LABELS[snap.role] : null,
    hasMembership: snap.hasMembership,
    isDevSession: false,
    entitledPages: snap.entitledPages,
    allowedPages: snap.allowedPages,
    canManageUsers: snap.canManageUsers,
    isPlatformAdmin: snap.isPlatformAdmin,
    impersonation: null,
    sessionSource: 'snapshot'
  }
}

async function persistSnapshotFromUser(
  user: SessionUser,
  nonce: string
): Promise<void> {
  if (user.isDevSession || user.impersonation) return
  if (!nonce) return
  const snapshot = buildSessionSnapshot({
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug,
    tenantName: user.companyName,
    membershipId: user.membershipId,
    role: user.role,
    allowedPages: user.allowedPages,
    entitledPages: user.entitledPages,
    canManageUsers: user.canManageUsers,
    isPlatformAdmin: user.isPlatformAdmin,
    hasMembership: user.hasMembership,
    nonce
  })
  await setSessionSnapshotCookie(snapshot)
}

/**
 * Request-scoped session (React.cache).
 * P2: aláírt snapshot cookie → 0 entitlement roundtrip meleg pathon.
 */
async function loadSessionUser(): Promise<SessionUser | null> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    if (!supabase) return null

    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user?.email) return null

    const cookieStore = await cookies()
    const nonce = cookieStore.get(APP_SESSION_NONCE_COOKIE)?.value ?? ''
    const impersonationId = cookieStore.get(IMPERSONATION_SESSION_COOKIE)
      ?.value
    const hdrs = await headers()
    const surface = hdrs.get('x-modul-surface')
    const pathname = hdrs.get('x-pathname') ?? ''
    const leanPlatform =
      surface === 'platform' ||
      pathname === '/platform' ||
      pathname.startsWith('/platform/')

    // Impersonation: mindig DB (rövid életű, ne cache-eljük)
    if (!impersonationId) {
      const snap = await verifySessionSnapshotToken(
        cookieStore.get(SESSION_SNAPSHOT_COOKIE)?.value
      )
      if (
        snap &&
        snap.sub === user.id &&
        snap.nonce === nonce &&
        Boolean(nonce)
      ) {
        // Platform surface: snapshot isPlatformAdmin elég
        if (leanPlatform) {
          return {
            ...sessionUserFromSnapshot(snap),
            companyName: 'Platform',
            tenantId: null,
            tenantSlug: null,
            membershipId: null,
            role: null,
            roleLabel: null,
            hasMembership: false,
            entitledPages: ['/home'],
            allowedPages: ['/home'],
            canManageUsers: false
          }
        }
        return sessionUserFromSnapshot(snap)
      }
    }

    // Platform konzol: csak platform_admins check — nincs membership / entitlements
    // Impersonation alatt mindig a cél user tenant sessionje kell (ne platform lean).
    if (leanPlatform && !impersonationId) {
      const { data: platformRow } = await supabase
        .from('platform_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .eq('active', true)
        .maybeSingle()

      const platformUser: SessionUser = {
        id: user.id,
        email: user.email,
        displayName: null,
        companyName: 'Platform',
        tenantId: null,
        tenantSlug: null,
        membershipId: null,
        role: null,
        roleLabel: null,
        hasMembership: false,
        isDevSession: false,
        entitledPages: ['/home'],
        allowedPages: ['/home'],
        canManageUsers: false,
        isPlatformAdmin: Boolean(platformRow),
        impersonation: null,
        sessionSource: 'db'
      }
      if (nonce) await persistSnapshotFromUser(platformUser, nonce)
      return platformUser
    }

    const preferredTenantId =
      cookieStore.get(CURRENT_TENANT_COOKIE)?.value ?? null

    const memberships = await listMembershipsForUser(supabase, user.id)
    const current = resolveCurrentTenant(memberships, preferredTenantId)

    let displayName: string | null = null
    {
      const { data: profileRow, error: profileError } = await supabase
        .from('user_profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle()
      if (profileError) {
        console.error('user_profiles', profileError.message)
      } else {
        displayName = profileRow?.display_name?.trim() || null
      }
    }

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
    let isPlatformAdmin = false

    if (current) {
      const [entitled, membershipPages, platformRow] = await Promise.all([
        listTenantEntitledPageKeys(supabase, current.tenantId),
        listAllowedPageKeys(supabase, current.membershipId, current.role),
        supabase
          .from('platform_admins')
          .select('user_id')
          .eq('user_id', user.id)
          .eq('active', true)
          .maybeSingle()
          .then((r) => r.data)
      ])

      entitledPages = entitled
      if (entitledPages.length <= 1) {
        const { count } = await supabase
          .from('tenant_entitlements')
          .select('feature_key', { count: 'exact', head: true })
          .eq('tenant_id', current.tenantId)
        if (!count) {
          entitledPages = [...ALL_PAGE_KEYS]
        }
      }

      allowedPages = intersectPages(membershipPages, entitledPages)
      isPlatformAdmin = Boolean(platformRow)
    } else {
      const { data: platformRow } = await supabase
        .from('platform_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .eq('active', true)
        .maybeSingle()
      isPlatformAdmin = Boolean(platformRow)
    }

    const canManageUsers =
      current?.role === 'owner' || current?.role === 'admin'

    let impersonation: ImpersonationInfo | null = null
    if (impersonationId) {
      const { data: imp } = await supabase
        .from('platform_impersonation_sessions')
        .select(
          'id, operator_user_id, target_user_id, tenant_id, expires_at, ended_at, tenants(name)'
        )
        .eq('id', impersonationId)
        .maybeSingle()

      if (
        imp &&
        !imp.ended_at &&
        imp.target_user_id === user.id &&
        new Date(imp.expires_at).getTime() > Date.now()
      ) {
        const tenantJoin = Array.isArray(imp.tenants)
          ? imp.tenants[0]
          : imp.tenants
        const tenantName =
          (tenantJoin as { name?: string } | null)?.name ??
          current?.tenantName ??
          'Cég'

        let operatorEmail: string | null = null
        try {
          const { createServiceClient } = await import(
            '@/lib/supabase/service'
          )
          const admin = createServiceClient()
          if (admin) {
            const { data } = await admin.auth.admin.getUserById(
              imp.operator_user_id
            )
            operatorEmail = data.user?.email ?? null
          }
        } catch {
          operatorEmail = null
        }

        impersonation = {
          sessionId: imp.id,
          operatorUserId: imp.operator_user_id,
          operatorEmail,
          targetEmail: user.email,
          tenantId: imp.tenant_id,
          tenantName,
          expiresAt: imp.expires_at
        }
        isPlatformAdmin = false
      }
    }

    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      displayName,
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
      isPlatformAdmin,
      impersonation,
      sessionSource: 'db'
    }

    if (nonce && !impersonation) {
      await persistSnapshotFromUser(sessionUser, nonce)
    }

    return sessionUser
  }

  if (isDevBypassEnabled()) {
    const cookieStore = await cookies()
    const raw = cookieStore.get(DEV_SESSION_COOKIE)?.value
    if (!raw) return null

    return {
      id: 'dev-user',
      email: decodeURIComponent(raw),
      displayName: null,
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
      isPlatformAdmin: true,
      impersonation: null,
      sessionSource: 'dev'
    }
  }

  return null
}

export const getSessionUser = cache(loadSessionUser)

/** Login után: snapshot azonnal, hogy az első /home ne DB-bundle legyen. */
export async function writeSessionSnapshotAfterLogin(input: {
  userId: string
  email: string
  displayName?: string | null
  nonce: string
  tenantId: string | null
  tenantSlug: string | null
  tenantName: string
  membershipId: string | null
  role: TenantRole | null
  allowedPages: string[]
  entitledPages: string[]
  canManageUsers: boolean
  isPlatformAdmin: boolean
  hasMembership: boolean
}): Promise<void> {
  const snapshot = buildSessionSnapshot({
    userId: input.userId,
    email: input.email,
    displayName: input.displayName ?? null,
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug,
    tenantName: input.tenantName,
    membershipId: input.membershipId,
    role: input.role,
    allowedPages: input.allowedPages,
    entitledPages: input.entitledPages,
    canManageUsers: input.canManageUsers,
    isPlatformAdmin: input.isPlatformAdmin,
    hasMembership: input.hasMembership,
    nonce: input.nonce
  })
  await setSessionSnapshotCookie(snapshot)
}
