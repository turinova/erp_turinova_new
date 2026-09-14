import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import {
  CURRENT_TENANT_COOKIE,
  IMPERSONATION_SESSION_COOKIE,
  OPERATOR_REFRESH_COOKIE,
  isSupabaseConfigured
} from '@/lib/auth/config'
import {
  normalizeHostname,
  PARTNER_HOME_PATH,
  PARTNER_INTERNAL_PREFIX,
  resolveAuthSurface
} from '@/lib/auth/surface'
import { createServiceClient } from '@/lib/supabase/service'

function cookieOpts(maxAge = 60 * 60) {
  const domain = process.env.COOKIE_DOMAIN?.trim() || undefined
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge,
    ...(domain ? { domain } : {})
  }
}

type CookieToSet = {
  name: string
  value: string
  options?: Record<string, unknown>
}

/**
 * App / partner host handoff: platform operátor → cél user session.
 * GET /api/platform/impersonation/complete?sid=&h=
 */
export async function GET(request: NextRequest) {
  const sid = request.nextUrl.searchParams.get('sid')
  const handoff = request.nextUrl.searchParams.get('h')

  if (!sid || !handoff) {
    return NextResponse.redirect(new URL('/login?reason=impersonation', request.url))
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL('/login?reason=impersonation', request.url))
  }

  const admin = createServiceClient()
  if (!admin) {
    return NextResponse.redirect(new URL('/login?reason=impersonation', request.url))
  }

  const { data: row } = await admin
    .from('platform_impersonation_sessions')
    .select(
      'id, tenant_id, subject_kind, target_user_id, expires_at, ended_at, handoff_token, magic_hash, operator_refresh_token'
    )
    .eq('id', sid)
    .maybeSingle()

  if (
    !row ||
    row.ended_at ||
    row.handoff_token !== handoff ||
    !row.magic_hash ||
    new Date(row.expires_at).getTime() <= Date.now()
  ) {
    return NextResponse.redirect(
      new URL('/login?reason=impersonation_expired', request.url)
    )
  }

  const isPartner = row.subject_kind === 'partner'
  const host = normalizeHostname(request.headers.get('host'))
  const surface = resolveAuthSurface(host)

  // Partner: partner hoston tiszta /home; staff/platform hoston path-mód /partner/home
  let homePath = '/home'
  if (isPartner && surface !== 'partner') {
    homePath = `${PARTNER_INTERNAL_PREFIX}${PARTNER_HOME_PATH}`
  }

  const redirectUrl = new URL(homePath, request.url)
  const pendingCookies: CookieToSet[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          pendingCookies.push(...cookiesToSet)
        }
      }
    }
  )

  const { error: otpError } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: row.magic_hash
  })

  if (otpError) {
    console.error('impersonation complete', otpError.message)
    return NextResponse.redirect(
      new URL('/login?reason=impersonation_failed', request.url)
    )
  }

  await admin
    .from('platform_impersonation_sessions')
    .update({
      handoff_token: null,
      magic_hash: null
    })
    .eq('id', sid)

  const response = NextResponse.redirect(redirectUrl)

  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options)
  }

  response.cookies.set(IMPERSONATION_SESSION_COOKIE, sid, cookieOpts())
  if (row.operator_refresh_token) {
    response.cookies.set(
      OPERATOR_REFRESH_COOKIE,
      row.operator_refresh_token,
      cookieOpts()
    )
  }
  // Partnernek ne állítsunk staff tenant cookie-t (téves ERP shell)
  if (!isPartner && row.tenant_id) {
    response.cookies.set(CURRENT_TENANT_COOKIE, row.tenant_id, cookieOpts())
  } else {
    response.cookies.set(CURRENT_TENANT_COOKIE, '', { ...cookieOpts(0), maxAge: 0 })
  }
  return response
}
