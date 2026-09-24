'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import {
  APP_SESSION_NONCE_COOKIE,
  CURRENT_TENANT_COOKIE,
  DEV_SESSION_COOKIE,
  SESSION_SNAPSHOT_COOKIE,
  isDevBypassEnabled,
  isSupabaseConfigured
} from '@/lib/auth/config'
import {
  clearAppSession,
  parseForwardedIp,
  registerAppSession
} from '@/lib/auth/app-session'
import {
  clearSessionSnapshotCookie,
  signSessionSnapshotAfterLogin
} from '@/lib/auth/session'
import {
  LOGIN_PENDING_NEXT_COOKIE,
  LOGIN_PENDING_NONCE_COOKIE,
  LOGIN_PENDING_SNAP_COOKIE,
  LOGIN_PENDING_TENANT_COOKIE,
  appSessionCookieOptions,
  clearAppAuthCookies,
  clearStaleSessionCookies,
  loginPendingCookieOptions,
  sessionSnapshotCookieOptions
} from '@/lib/auth/session-cookies'
import { ALL_PAGE_KEYS } from '@/lib/permissions/pages'
import { listAllowedPageKeys } from '@/lib/permissions/access'
import {
  intersectPages,
  listTenantEntitledPageKeys
} from '@/lib/platform/entitlements'
import { createClient } from '@/lib/supabase/server'
import {
  listMembershipsForUser,
  resolveCurrentTenant
} from '@/lib/tenancy/memberships'
import { resolveAuthSurface, staffLoginPath } from '@/lib/auth/surface'

export type LoginState = {
  error?: string
}

function sanitizeNextPath(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) return '/home'
  if (path.startsWith('/auth/')) return '/home'
  return path.slice(0, 200)
}

async function stageLoginBootstrap(input: {
  nonce: string
  next: string
  tenantId: string | null
  snapshotToken: string | null
}) {
  const cookieStore = await cookies()
  // Ne wipe-olj signIn után — elrontja a sb-* Set-Cookie jar-t.
  // Stale wipe a loginAction elején (clearStaleSessionCookies).

  const pending = loginPendingCookieOptions(120)
  cookieStore.set(LOGIN_PENDING_NONCE_COOKIE, input.nonce, pending)
  cookieStore.set(
    LOGIN_PENDING_NEXT_COOKIE,
    sanitizeNextPath(input.next),
    pending
  )
  if (input.snapshotToken) {
    cookieStore.set(LOGIN_PENDING_SNAP_COOKIE, input.snapshotToken, pending)
  }
  if (input.tenantId) {
    cookieStore.set(LOGIN_PENDING_TENANT_COOKIE, input.tenantId, pending)
  }

  // Belt+suspenders: hosszú életű nonce is (ha a SA cookie megmarad)
  cookieStore.set(APP_SESSION_NONCE_COOKIE, input.nonce, appSessionCookieOptions())
  if (input.snapshotToken) {
    cookieStore.set(
      SESSION_SNAPSHOT_COOKIE,
      input.snapshotToken,
      sessionSnapshotCookieOptions()
    )
  }
  if (input.tenantId) {
    cookieStore.set(
      CURRENT_TENANT_COOKIE,
      input.tenantId,
      appSessionCookieOptions()
    )
  }

  redirect('/auth/session-bootstrap')
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')

  if (!email || !password) {
    return { error: 'Add meg az email címet és a jelszót.' }
  }

  if (isSupabaseConfigured()) {
    // Stale wipe BEFORE signIn — ne a Set-Cookie jar után
    {
      const cookieStore = await cookies()
      clearStaleSessionCookies(cookieStore)
    }

    const supabase = await createClient()
    if (!supabase) {
      return { error: 'A bejelentkezés most nem elérhető. Próbáld újra később.' }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error || !data.user) {
      const msg = error?.message?.toLowerCase() ?? ''
      if (msg.includes('email not confirmed')) {
        return {
          error:
            'Az email még nincs megerősítve. Supabase → Authentication → Users: kapcsold ki a Confirm email-t localhoz, vagy erősítsd meg a címet.'
        }
      }
      if (msg.includes('invalid login')) {
        return { error: 'Hibás email vagy jelszó.' }
      }
      return {
        error: error?.message
          ? `Belépés sikertelen: ${error.message}`
          : 'Hibás email vagy jelszó.'
      }
    }

    const { data: partnerRow } = await supabase
      .from('partner_profiles')
      .select('user_id')
      .eq('user_id', data.user.id)
      .maybeSingle()

    if (partnerRow) {
      await supabase.auth.signOut()
      return {
        error:
          'Ez asztalos (partner) fiók. Lépj be az optinova.hu címen (asztalos portál).'
      }
    }

    const memberships = await listMembershipsForUser(supabase, data.user.id)
    const current = resolveCurrentTenant(memberships)

    const hdrs = await headers()
    const userAgent = hdrs.get('user-agent')
    const ip = parseForwardedIp(hdrs.get('x-forwarded-for'))
    const surface = resolveAuthSurface(hdrs.get('host') ?? '')

    const { data: platformRow } = await supabase
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', data.user.id)
      .eq('active', true)
      .maybeSingle()

    let sessionNonce: string
    try {
      sessionNonce = await registerAppSession(supabase, {
        userId: data.user.id,
        tenantId: current?.tenantId ?? null,
        userAgent,
        ip
      })
    } catch {
      await supabase.auth.signOut()
      return {
        error:
          'Belépés sikertelen: munkamenet regisztráció. Futtasd a seats/session migrációt.'
      }
    }

    if (surface === 'platform') {
      if (!platformRow) {
        await supabase.auth.signOut()
        return {
          error:
            'Ez a belépés csak platform operátoroknak szól (admin.optinova.hu).'
        }
      }
      const snap = await signSessionSnapshotAfterLogin({
        userId: data.user.id,
        email: data.user.email!,
        nonce: sessionNonce,
        tenantId: null,
        tenantSlug: null,
        tenantName: 'Platform',
        membershipId: null,
        role: null,
        allowedPages: ['/home'],
        entitledPages: ['/home'],
        canManageUsers: false,
        isPlatformAdmin: true,
        hasMembership: false
      })
      await stageLoginBootstrap({
        nonce: sessionNonce,
        next: '/',
        tenantId: null,
        snapshotToken: snap
      })
    }

    if (current) {
      let entitledPages = await listTenantEntitledPageKeys(
        supabase,
        current.tenantId
      )
      if (entitledPages.length <= 1) {
        const { count } = await supabase
          .from('tenant_entitlements')
          .select('feature_key', { count: 'exact', head: true })
          .eq('tenant_id', current.tenantId)
        if (!count) entitledPages = [...ALL_PAGE_KEYS]
      }
      const membershipPages = await listAllowedPageKeys(
        supabase,
        current.membershipId,
        current.role
      )
      const allowedPages = intersectPages(membershipPages, entitledPages)

      let displayName: string | null = null
      {
        const { data: profileRow } = await supabase
          .from('user_profiles')
          .select('display_name')
          .eq('user_id', data.user.id)
          .maybeSingle()
        displayName = profileRow?.display_name?.trim() || null
      }

      const snap = await signSessionSnapshotAfterLogin({
        userId: data.user.id,
        email: data.user.email!,
        displayName,
        nonce: sessionNonce,
        tenantId: current.tenantId,
        tenantSlug: current.tenantSlug,
        tenantName: current.tenantName,
        membershipId: current.membershipId,
        role: current.role,
        allowedPages,
        entitledPages,
        canManageUsers:
          current.role === 'owner' || current.role === 'admin',
        isPlatformAdmin: Boolean(platformRow),
        hasMembership: true
      })

      try {
        const { ensureFirstLoginMarked } = await import(
          '@/lib/platform/onboarding-flags'
        )
        await ensureFirstLoginMarked(current.tenantId)
      } catch {
        // ne blokkolja a belépést
      }

      await stageLoginBootstrap({
        nonce: sessionNonce,
        next: '/home',
        tenantId: current.tenantId,
        snapshotToken: snap
      })
    }

    if (platformRow) {
      const snap = await signSessionSnapshotAfterLogin({
        userId: data.user.id,
        email: data.user.email!,
        nonce: sessionNonce,
        tenantId: null,
        tenantSlug: null,
        tenantName: 'Platform',
        membershipId: null,
        role: null,
        allowedPages: ['/home'],
        entitledPages: ['/home'],
        canManageUsers: false,
        isPlatformAdmin: true,
        hasMembership: false
      })
      const platformOrigin = process.env.NEXT_PUBLIC_PLATFORM_ORIGIN?.replace(
        /\/$/,
        ''
      )
      const next = platformOrigin ? `${platformOrigin}/` : '/platform'
      // Külső origin: cookie-t ezen a hoston állítjuk, majd külsőre megyünk
      await stageLoginBootstrap({
        nonce: sessionNonce,
        next: next.startsWith('http') ? '/platform' : next,
        tenantId: null,
        snapshotToken: snap
      })
    }

    await clearSessionSnapshotCookie()
    await stageLoginBootstrap({
      nonce: sessionNonce,
      next: '/no-access',
      tenantId: null,
      snapshotToken: null
    })
  }

  if (isDevBypassEnabled()) {
    const cookieStore = await cookies()
    clearAppAuthCookies(cookieStore)
    cookieStore.set(DEV_SESSION_COOKIE, encodeURIComponent(email), {
      ...appSessionCookieOptions()
    })
    redirect('/home')
  }

  return {
    error:
      'Nincs beállítva a Supabase kapcsolat. Töltsd ki a NEXT_PUBLIC_SUPABASE_* értékeket az .env.local-ban (lásd docs/19-supabase-setup.md).'
  }
}

export async function logoutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    if (supabase) {
      const {
        data: { user }
      } = await supabase.auth.getUser()
      if (user) {
        await clearAppSession(supabase, user.id)
      }
      await supabase.auth.signOut()
    }
  }

  const cookieStore = await cookies()
  clearAppAuthCookies(cookieStore)

  const hdrs = await headers()
  const surface = resolveAuthSurface(hdrs.get('host') ?? '')
  redirect(staffLoginPath(surface))
}
