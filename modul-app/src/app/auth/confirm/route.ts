import { NextResponse, type NextRequest } from 'next/server'

import {
  PARTNER_FORGOT_PASSWORD_PATH,
  PARTNER_LOGIN_PATH,
  PARTNER_RESET_PASSWORD_PATH,
  resolveAuthSurface
} from '@/lib/auth/surface'
import { createClient } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'

/**
 * Email link (jelszó-visszaállítás / megerősítés) → session → tovább a next oldalra.
 * Tartalék path — migrált first-login primary = claim UI (nincs email).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    ''
  const partnerHost = resolveAuthSurface(host) === 'partner'
  const loginPath = partnerHost ? PARTNER_LOGIN_PATH : '/partner/login'
  const forgotPath = partnerHost
    ? PARTNER_FORGOT_PASSWORD_PATH
    : '/partner/elfelejtett-jelszo'
  const defaultNext = partnerHost
    ? PARTNER_RESET_PASSWORD_PATH
    : '/partner/uj-jelszo'

  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const nextRaw = searchParams.get('next') || defaultNext
  const next =
    nextRaw.startsWith('/') && !nextRaw.startsWith('//')
      ? nextRaw
      : defaultNext

  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.redirect(new URL(loginPath, origin))
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('auth/confirm code', error.message)
      return NextResponse.redirect(
        new URL(`${forgotPath}?reason=link_invalid`, origin)
      )
    }
    return NextResponse.redirect(new URL(next, origin))
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash
    })
    if (error) {
      console.error('auth/confirm otp', error.message)
      return NextResponse.redirect(
        new URL(`${forgotPath}?reason=link_invalid`, origin)
      )
    }
    return NextResponse.redirect(new URL(next, origin))
  }

  return NextResponse.redirect(new URL(loginPath, origin))
}
