import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import {
  APP_SESSION_NONCE_COOKIE,
  CURRENT_TENANT_COOKIE,
  DEV_SESSION_COOKIE,
  IMPERSONATION_SESSION_COOKIE,
  isDevBypassEnabled,
  isSupabaseConfigured
} from '@/lib/auth/config'
import { isAppSessionValid } from '@/lib/auth/app-session'
import {
  getPlatformPublicOrigin,
  isPartnerContext,
  isPartnerPath,
  isPlatformPath,
  isStaffOnlyPath,
  isTenantAppPath,
  normalizeHostname,
  partnerCleanToInternal,
  partnerInternalToClean,
  platformCleanToInternal,
  platformInternalToClean,
  PARTNER_HOME_PATH,
  PARTNER_INTERNAL_PREFIX,
  PARTNER_LOGIN_PATH,
  PARTNER_REGISTER_PATH,
  resolveAuthSurface
} from '@/lib/auth/surface'

function withSurfaceHeaders(
  request: NextRequest,
  pathname: string,
  surfaceLabel: 'staff' | 'partner' | 'platform',
  init?: { rewriteUrl?: URL }
) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)
  requestHeaders.set('x-modul-surface', surfaceLabel)

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

function redirectExternal(origin: string, pathname: string) {
  const url = new URL(pathname, origin)
  return NextResponse.redirect(url)
}

/** Partner home: clean /home on partner host; /partner/home on staff (path-mode). */
function partnerHomePathname(
  surface: ReturnType<typeof resolveAuthSurface>
): string {
  return surface === 'partner'
    ? PARTNER_HOME_PATH
    : `${PARTNER_INTERNAL_PREFIX}${PARTNER_HOME_PATH}`
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const hostname = normalizeHostname(request.headers.get('host'))
  const surface = resolveAuthSurface(hostname)

  let rewriteTarget: string | null = null
  let surfaceLabel: 'staff' | 'partner' | 'platform' =
    surface === 'partner'
      ? 'partner'
      : surface === 'platform'
        ? 'platform'
        : 'staff'

  // --- Platform host (admin.): clean URLs + block tenant app ---
  if (surface === 'platform') {
    // API routes (impersonation complete, etc.) must pass through
    if (pathname.startsWith('/api/')) {
      // fall through to auth / public handoff handling below
    } else {
      if (isPlatformPath(pathname) && pathname !== '/platform') {
        const clean = platformInternalToClean(pathname)
        if (clean !== null) return redirectTo(request, clean === '' ? '/' : clean)
      }
      if (pathname === '/platform') {
        return redirectTo(request, '/')
      }
      if (isTenantAppPath(pathname) && pathname !== '/login') {
        return redirectTo(request, '/')
      }
      if (pathname !== '/login') {
        rewriteTarget = platformCleanToInternal(pathname)
        if (!rewriteTarget && !isPlatformPath(pathname)) {
          return redirectTo(request, '/')
        }
      }
    }
  }

  // --- Partner host: clean URLs + block staff-only ---
  if (surface === 'partner') {
    if (pathname.startsWith('/api/')) {
      // allow API (shared PDF/optimize + impersonation complete)
    } else {
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
  }

  // Staff host: optional redirect /platform → admin origin
  if (surface === 'staff' && isPlatformPath(pathname)) {
    const platformOrigin = getPlatformPublicOrigin()
    if (platformOrigin) {
      const clean = platformInternalToClean(pathname) ?? '/'
      return redirectExternal(platformOrigin, clean === '' ? '/' : clean)
    }
  }

  const partnerCtx =
    surface === 'partner' || isPartnerContext(hostname, pathname)
  if (partnerCtx) surfaceLabel = 'partner'
  else if (surface === 'platform' || isPlatformPath(pathname)) {
    surfaceLabel = 'platform'
  }

  function buildResponse() {
    if (rewriteTarget) {
      const url = request.nextUrl.clone()
      url.pathname = rewriteTarget
      return withSurfaceHeaders(request, pathname, surfaceLabel, {
        rewriteUrl: url
      })
    }
    return withSurfaceHeaders(request, pathname, surfaceLabel)
  }

  let supabaseResponse = buildResponse()

  const isPublicAsset =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')

  const isPublicPartnerApi =
    pathname === '/api/partner/companies' ||
    pathname.startsWith('/api/partner/companies/')

  const isPublicImpersonationHandoff =
    pathname.startsWith('/api/platform/impersonation/complete')

  const isPublicAuth =
    ((surface === 'staff' || surface === 'platform') &&
      pathname === '/login') ||
    (surface === 'partner' &&
      (pathname === PARTNER_LOGIN_PATH ||
        pathname === PARTNER_REGISTER_PATH)) ||
    (surface === 'staff' &&
      (pathname === '/partner/login' || pathname === '/partner/register'))

  if (isPublicAsset || isPublicPartnerApi || isPublicImpersonationHandoff) {
    return supabaseResponse
  }

  let isAuthenticated = false
  let isPartnerUser = false
  let hasStaffMembership = false

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
      pathname === '/api/kereso' ||
      pathname.startsWith('/api/kereso/') ||
      /^\/api\/ajanlatok\/[^/]+\/pdf$/.test(pathname)

    if (user) {
      if (partnerCtx) {
        const { data: partnerRow } = await supabase
          .from('partner_profiles')
          .select('user_id, status')
          .eq('user_id', user.id)
          .maybeSingle()

        if (partnerRow && partnerRow.status === 'disabled') {
          await supabase.auth.signOut()
          return redirectTo(request, PARTNER_LOGIN_PATH, 'disabled')
        }

        if (partnerRow) {
          isAuthenticated = true
          isPartnerUser = true
        } else if (!isPublicAuth) {
          await supabase.auth.signOut()
          return redirectTo(request, PARTNER_LOGIN_PATH)
        }
      } else {
        const [{ data: partnerRow }, { data: memberships }] = await Promise.all([
          supabase
            .from('partner_profiles')
            .select('user_id, status')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('tenant_memberships')
            .select('id')
            .eq('user_id', user.id)
            .limit(1)
        ])

        if (partnerRow && partnerRow.status !== 'disabled') {
          isPartnerUser = true
        }
        hasStaffMembership = (memberships?.length ?? 0) > 0

        const impersonationId = request.cookies.get(
          IMPERSONATION_SESSION_COOKIE
        )?.value

        let impersonationOk = false
        if (impersonationId) {
          const { data: imp } = await supabase
            .from('platform_impersonation_sessions')
            .select('id, target_user_id, expires_at, ended_at')
            .eq('id', impersonationId)
            .maybeSingle()

          if (
            imp &&
            !imp.ended_at &&
            imp.target_user_id === user.id &&
            new Date(imp.expires_at).getTime() > Date.now()
          ) {
            impersonationOk = true
            isAuthenticated = true
          }
        }

        if (!impersonationOk) {
          const nonce = request.cookies.get(APP_SESSION_NONCE_COOKIE)?.value
          const valid = await isAppSessionValid(supabase, user.id, nonce)

          if (valid) {
            isAuthenticated = true
          } else if (isPartnerUser && !hasStaffMembership) {
            // Partner-only session on staff host (path-mode / impersonation)
            isAuthenticated = true
          } else if (isPartnerSharedApi && isPartnerUser) {
            isAuthenticated = true
          } else if (isPartnerSharedApi) {
            await supabase.auth.signOut()
            const response = redirectTo(request, '/login', 'session_replaced')
            response.cookies.delete(APP_SESSION_NONCE_COOKIE)
            response.cookies.delete(CURRENT_TENANT_COOKIE)
            response.cookies.delete(IMPERSONATION_SESSION_COOKIE)
            return response
          } else {
            await supabase.auth.signOut()
            const response = redirectTo(request, '/login', 'session_replaced')
            response.cookies.delete(APP_SESSION_NONCE_COOKIE)
            response.cookies.delete(CURRENT_TENANT_COOKIE)
            response.cookies.delete(IMPERSONATION_SESSION_COOKIE)
            return response
          }
        }
      }
    }
  } else if (isDevBypassEnabled()) {
    isAuthenticated = Boolean(
      request.cookies.get(DEV_SESSION_COOKIE)?.value
    )
  }

  if (!isAuthenticated && !isPublicAuth) {
    return redirectTo(
      request,
      partnerCtx ? PARTNER_LOGIN_PATH : '/login'
    )
  }

  const partnerHome = partnerHomePathname(surface)

  // Partner-only: ne ragadjon staff /home ↔ /no-access loopba (path-mód)
  if (
    isAuthenticated &&
    isPartnerUser &&
    !hasStaffMembership &&
    surface === 'staff' &&
    (pathname === '/home' ||
      pathname === '/no-access' ||
      pathname === '/nincs-hozzaferes')
  ) {
    return redirectTo(request, partnerHome)
  }

  if (
    isAuthenticated &&
    (pathname === PARTNER_LOGIN_PATH ||
      pathname === PARTNER_REGISTER_PATH ||
      pathname === '/partner/login' ||
      pathname === '/partner/register' ||
      pathname === '/login')
  ) {
    if (isPartnerUser && !hasStaffMembership) {
      return redirectTo(request, partnerHome)
    }
    if (surface === 'partner' || partnerCtx) {
      return redirectTo(request, partnerHome)
    }
    if (surface === 'platform') {
      return redirectTo(request, '/')
    }
    if (surface === 'staff') {
      return redirectTo(request, '/home')
    }
  }

  return supabaseResponse
}
