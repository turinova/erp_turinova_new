'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import {
  APP_SESSION_NONCE_COOKIE,
  CURRENT_TENANT_COOKIE,
  DEV_SESSION_COOKIE,
  IMPERSONATION_SESSION_COOKIE,
  OPERATOR_REFRESH_COOKIE,
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
  writeSessionSnapshotAfterLogin
} from '@/lib/auth/session'
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

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30
  }
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

    const cookieStore = await cookies()
    cookieStore.set(
      APP_SESSION_NONCE_COOKIE,
      sessionNonce,
      sessionCookieOptions()
    )

    if (surface === 'platform') {
      if (!platformRow) {
        await supabase.auth.signOut()
        cookieStore.delete(APP_SESSION_NONCE_COOKIE)
        cookieStore.delete(SESSION_SNAPSHOT_COOKIE)
        return {
          error:
            'Ez a belépés csak platform operátoroknak szól (admin.optinova.hu).'
        }
      }
      cookieStore.delete(CURRENT_TENANT_COOKIE)
      await writeSessionSnapshotAfterLogin({
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
      redirect('/')
    }

    if (current) {
      cookieStore.set(CURRENT_TENANT_COOKIE, current.tenantId, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      })

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

      await writeSessionSnapshotAfterLogin({
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
      redirect('/home')
    }

    if (platformRow) {
      cookieStore.delete(CURRENT_TENANT_COOKIE)
      await writeSessionSnapshotAfterLogin({
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
      if (platformOrigin) {
        redirect(`${platformOrigin}/`)
      }
      redirect('/platform')
    }

    cookieStore.delete(CURRENT_TENANT_COOKIE)
    await clearSessionSnapshotCookie()
    redirect('/no-access')
  }

  if (isDevBypassEnabled()) {
    const cookieStore = await cookies()
    cookieStore.set(DEV_SESSION_COOKIE, encodeURIComponent(email), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production'
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
  cookieStore.delete(CURRENT_TENANT_COOKIE)
  cookieStore.delete(APP_SESSION_NONCE_COOKIE)
  cookieStore.delete(SESSION_SNAPSHOT_COOKIE)
  cookieStore.delete(IMPERSONATION_SESSION_COOKIE)
  cookieStore.delete(OPERATOR_REFRESH_COOKIE)

  if (isDevBypassEnabled()) {
    cookieStore.delete(DEV_SESSION_COOKIE)
  }

  const hdrs = await headers()
  const surface = resolveAuthSurface(hdrs.get('host') ?? '')
  redirect(staffLoginPath(surface))
}
