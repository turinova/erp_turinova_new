import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import {
  APP_SESSION_NONCE_COOKIE,
  CURRENT_TENANT_COOKIE,
  DEV_SESSION_COOKIE,
  isDevBypassEnabled,
  isSupabaseConfigured
} from '@/lib/auth/config'
import { isAppSessionValid } from '@/lib/auth/app-session'
import {
  isPartnerContext,
  isPartnerPath,
  isStaffOnlyPath,
  normalizeHostname,
  partnerCleanToInternal,
  partnerInternalToClean,
  PARTNER_HOME_PATH,
  PARTNER_LOGIN_PATH,
  PARTNER_REGISTER_PATH,
  resolveAuthSurface
} from '@/lib/auth/surface'

function withSurfaceHeaders(
  request: NextRequest,
  pathname: string,
  init?: { rewriteUrl?: URL }
) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)
  const partnerCtx =
    resolveAuthSurface(request.headers.get('host') ?? '') === 'partner' ||
    isPartnerContext(request.headers.get('host') ?? '', pathname)
  requestHeaders.set('x-modul-surface', partnerCtx ? 'partner' : 'staff')

  if (init?.rewriteUrl) {
    return NextResponse.rewrite(init.rewriteUrl, {
      request: { headers: requestHeaders }
    })
  }
  return NextResponse.next({
    request: { headers: requestHeaders }
  })
}

function redirectTo(request: NextRequest, pathname: string, reason?: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  if (reason) url.searchParams.set('reason', reason)
  else url.searchParams.delete('reason')
  return NextResponse.redirect(url)
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const hostname = normalizeHostname(request.headers.get('host'))
  const surface = resolveAuthSurface(hostname)

  // --- Partner host: clean URLs + block staff-only ---
  let rewriteTarget: string | null = null
  if (surface === 'partner') {
    if (isPartnerPath(pathname)) {
      const clean = partnerInternalToClean(pathname)
      if (clean) return redirectTo(request, clean)
    }
    if (pathname === '/' || pathname === '') {
      return redirectTo(request, PARTNER_HOME_PATH)
    }
    if (isStaffOnlyPath(pathname)) {
      return redirectTo(request, PARTNER_LOGIN_PATH)
    }
    rewriteTarget = partnerCleanToInternal(pathname)
  }

  const partnerCtx = surface === 'partner' || isPartnerContext(hostname, pathname)

  function buildResponse() {
    if (rewriteTarget) {
      const url = request.nextUrl.clone()
      url.pathname = rewriteTarget
      return withSurfaceHeaders(request, pathname, { rewriteUrl: url })
    }
    return withSurfaceHeaders(request, pathname)
  }

  let supabaseResponse = buildResponse()

  const isPublicAsset =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')

  const isPublicPartnerApi =
    pathname === '/api/partner/companies' ||
    pathname.startsWith('/api/partner/companies/')

  const isPublicAuth =
    (surface === 'staff' && pathname === '/login') ||
    (surface === 'partner' &&
      (pathname === PARTNER_LOGIN_PATH ||
        pathname === PARTNER_REGISTER_PATH)) ||
    (surface === 'staff' &&
      (pathname === '/partner/login' || pathname === '/partner/register'))

  if (isPublicAsset || isPublicPartnerApi) {
    return supabaseResponse
  }

  let isAuthenticated = false

  if (isSupabaseConfigured()) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(
            cookiesToSet: {
              name: string
              value: string
              options?: Record<string, unknown>
            }[]
          ) {
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value)
            })
            supabaseResponse = buildResponse()
            cookiesToSet.forEach(({ name, value, options }) => {
              supabaseResponse.cookies.set(name, value, options)
            })
          }
        }
      }
    )

    const {
      data: { user }
    } = await supabase.auth.getUser()

    const isPartnerSharedApi =
      pathname === '/api/optimize' ||
      pathname.startsWith('/api/optimize/') ||
      /^\/api\/ajanlatok\/[^/]+\/pdf$/.test(pathname)

    if (user) {
      if (partnerCtx) {
        const { data: partnerRow } = await supabase
          .from('partner_profiles')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (partnerRow) {
          isAuthenticated = true
        } else if (!isPublicAuth) {
          await supabase.auth.signOut()
          return redirectTo(request, PARTNER_LOGIN_PATH)
        }
      } else {
        const nonce = request.cookies.get(APP_SESSION_NONCE_COOKIE)?.value
        const valid = await isAppSessionValid(supabase, user.id, nonce)

        if (valid) {
          isAuthenticated = true
        } else if (isPartnerSharedApi) {
          const { data: partnerRow } = await supabase
            .from('partner_profiles')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle()

          if (partnerRow) {
            isAuthenticated = true
          } else {
            await supabase.auth.signOut()
            const response = redirectTo(request, '/login', 'session_replaced')
            response.cookies.delete(APP_SESSION_NONCE_COOKIE)
            response.cookies.delete(CURRENT_TENANT_COOKIE)
            return response
          }
        } else {
          await supabase.auth.signOut()
          const response = redirectTo(request, '/login', 'session_replaced')
          response.cookies.delete(APP_SESSION_NONCE_COOKIE)
          response.cookies.delete(CURRENT_TENANT_COOKIE)
          return response
        }
      }
    }
  } else if (isDevBypassEnabled()) {
    isAuthenticated = Boolean(
      request.cookies.get(DEV_SESSION_COOKIE)?.value
    )
  }

  if (!isAuthenticated && !isPublicAuth) {
    return redirectTo(request, partnerCtx ? PARTNER_LOGIN_PATH : '/login')
  }

  if (isAuthenticated && surface === 'staff' && pathname === '/login') {
    return redirectTo(request, '/home')
  }

  if (
    isAuthenticated &&
    (pathname === PARTNER_LOGIN_PATH ||
      pathname === PARTNER_REGISTER_PATH ||
      pathname === '/partner/login' ||
      pathname === '/partner/register')
  ) {
    return redirectTo(request, PARTNER_HOME_PATH)
  }

  return supabaseResponse
}
