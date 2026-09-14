'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import {
  APP_SESSION_NONCE_COOKIE,
  CURRENT_TENANT_COOKIE,
  DEV_SESSION_COOKIE,
  isDevBypassEnabled,
  isSupabaseConfigured
} from '@/lib/auth/config'
import {
  clearAppSession,
  parseForwardedIp,
  registerAppSession
} from '@/lib/auth/app-session'
import { createClient } from '@/lib/supabase/server'
import {
  listMembershipsForUser,
  resolveCurrentTenant
} from '@/lib/tenancy/memberships'

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
          'Ez asztalos (partner) fiók. Lépj be az optinova.hu /partner/login felületen.'
      }
    }

    const memberships = await listMembershipsForUser(supabase, data.user.id)
    const current = resolveCurrentTenant(memberships)

    const hdrs = await headers()
    const userAgent = hdrs.get('user-agent')
    const ip = parseForwardedIp(hdrs.get('x-forwarded-for'))

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

    if (current) {
      cookieStore.set(CURRENT_TENANT_COOKIE, current.tenantId, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      })
      redirect('/home')
    }

    cookieStore.delete(CURRENT_TENANT_COOKIE)
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

  if (isDevBypassEnabled()) {
    cookieStore.delete(DEV_SESSION_COOKIE)
  }

  redirect('/login')
}
