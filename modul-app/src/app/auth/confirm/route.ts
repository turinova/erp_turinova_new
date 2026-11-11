import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

import { isSupabaseConfigured } from '@/lib/auth/config'
import {
  PARTNER_FORGOT_PASSWORD_PATH,
  PARTNER_LOGIN_PATH,
  PARTNER_RESET_PASSWORD_PATH,
  resolveAuthSurface
} from '@/lib/auth/surface'

/**
 * Email link (recovery / confirm) → session cookie → next.
 *
 * Prefer `token_hash` + `verifyOtp` (works cross-device). PKCE `code` is legacy.
 * Migrated first-login primary path = claim UI (no email).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const { searchParams } = url
  const hostHeader =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    ''
  const partnerHost = resolveAuthSurface(hostHeader) === 'partner'
  const loginPath = partnerHost ? PARTNER_LOGIN_PATH : '/partner/login'
  const forgotPath = partnerHost
    ? PARTNER_FORGOT_PASSWORD_PATH
    : '/partner/elfelejtett-jelszo'
  const defaultNext = partnerHost
    ? PARTNER_RESET_PASSWORD_PATH
    : '/partner/uj-jelszo'

  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const nextRaw = searchParams.get('next') || defaultNext
  const next =
    nextRaw.startsWith('/') && !nextRaw.startsWith('//')
      ? nextRaw
      : defaultNext

  const fail = (path: string) =>
    NextResponse.redirect(new URL(path, url.origin))

  if (!isSupabaseConfigured()) {
    return fail(loginPath)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return fail(loginPath)
  }

  // Cookie-ket a redirect response-ra írjuk (SSR hivatalos minta).
  let response = NextResponse.redirect(new URL(next, url.origin))

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(
        cookiesToSet: {
          name: string
          value: string
          options?: Parameters<typeof response.cookies.set>[2]
        }[]
      ) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        response = NextResponse.redirect(new URL(next, url.origin))
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      }
    }
  })

  // 1) token_hash — eszközfüggetlen (email template ajánlás)
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash
    })
    if (error) {
      console.error('auth/confirm otp', type, error.message)
      // Levelezők gyakran előre megnyitják a linket: a cím ilyenkor már megerősített.
      if (type !== 'recovery') {
        return fail(`${loginPath}?reason=confirm_link`)
      }
      return fail(`${forgotPath}?reason=link_invalid`)
    }
    return response
  }

  // 2) PKCE code — csak ugyanaz a böngésző (legacy / ConfirmationURL)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('auth/confirm code', error.message)
      return fail(`${forgotPath}?reason=link_invalid`)
    }
    return response
  }

  return fail(loginPath)
}
