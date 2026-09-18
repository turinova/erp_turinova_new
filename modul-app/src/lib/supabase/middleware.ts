import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import {
  APP_SESSION_NONCE_COOKIE,
  CURRENT_TENANT_COOKIE,
  DEV_SESSION_COOKIE,
  IMPERSONATION_SESSION_COOKIE,
  SESSION_SNAPSHOT_COOKIE,
  isDevBypassEnabled,
  isSupabaseConfigured
} from '@/lib/auth/config'
import { isAppSessionValid } from '@/lib/auth/app-session'
import { snapshotMatchesRequest } from '@/lib/auth/session-snapshot'
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
  PARTNER_FORGOT_PASSWORD_PATH,
  PARTNER_RESET_PASSWORD_PATH,
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

function isPublicMarketingPath(pathname: string) {
  return (
    pathname === '/' ||
    pathname === '/hamarosan' ||
    pathname === '/arak' ||
    pathname === '/kapcsolat' ||
    pathname === '/hogyan-mukodik' ||
    pathname === '/a-tortenetunk' ||
    pathname === '/esettanulmany' ||
    pathname.startsWith('/esettanulmany/') ||
    pathname === '/ceges-belepes' ||
    pathname === '/impresszum' ||
    pathname === '/aszf' ||
    pathname === '/adatkezelesi-tajekoztato'
  )
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
      // `/` is marketing-public on partner only. On admin, rewrite `/` → `/platform`
      // (never skip rewrite for `/` — that caused `/` ⇄ `/platform` redirect loops).
      if (pathname !== '/login') {
        if (isPublicMarketingPath(pathname) && pathname !== '/') {
          return redirectTo(request, '/')
        }
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
      if (pathname === '/hamarosan') {
        return redirectTo(request, '/')
      }
      // Staff-only paths: allow through; after auth we gate (staff session OK).
      // Marketing pages stay at app routes (no /partner rewrite)
      if (isPublicMarketingPath(pathname)) {
        rewriteTarget = null
      } else {
        rewriteTarget = partnerCleanToInternal(pathname)
      }
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

  /** Pi → cloud sync: Bearer / x-footcounter-secret, no user session. */
  const isPublicFootcounterSync = pathname === '/api/footcounter/sync'

  const isPublicAuth =
    (surface !== 'platform' && isPublicMarketingPath(pathname)) ||
    ((surface === 'staff' || surface === 'platform') &&
      pathname === '/login') ||
    pathname === '/auth/confirm' ||
    pathname.startsWith('/auth/confirm/') ||
    (surface === 'partner' &&
      (pathname === PARTNER_LOGIN_PATH ||
        pathname === PARTNER_REGISTER_PATH ||
        pathname === PARTNER_FORGOT_PASSWORD_PATH ||
        pathname === PARTNER_RESET_PASSWORD_PATH)) ||
    (surface === 'staff' &&
      (pathname === '/partner/login' ||
        pathname === '/partner/register' ||
        pathname === '/partner/elfelejtett-jelszo' ||
        pathname === '/partner/uj-jelszo'))

  if (
    isPublicAsset ||
    isPublicPartnerApi ||
    isPublicImpersonationHandoff ||
    isPublicFootcounterSync
  ) {
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

    const isKeresoApi =
      pathname === '/api/kereso' || pathname.startsWith('/api/kereso/')

    const isPartnerSharedApi =
      pathname === '/api/optimize' ||
      pathname.startsWith('/api/optimize/') ||
      isKeresoApi ||
      /^\/api\/ajanlatok\/[^/]+\/pdf$/.test(pathname)

    if (user) {
      // Kereső keystroke: skip partner/membership/isAppSessionValid waterfall.
      // Az API lean auth + RLS dönt.
      if (isKeresoApi) {
        isAuthenticated = true
      } else if (partnerCtx) {
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
          // Céges belépés a partner marketing hoston (MODUL_AUTH_SURFACE=partner)
          const nonce = request.cookies.get(APP_SESSION_NONCE_COOKIE)?.value
          const snapshotToken = request.cookies.get(SESSION_SNAPSHOT_COOKIE)
            ?.value
          const snap = await snapshotMatchesRequest({
            token: snapshotToken,
            userId: user.id,
            nonce
          })

          if (snap?.hasMembership) {
            const valid = await isAppSessionValid(supabase, user.id, nonce)
            if (valid) {
              isAuthenticated = true
              hasStaffMembership = true
              isPartnerUser = false
            } else {
              await supabase.auth.signOut()
              const response = redirectTo(request, '/ceges-belepes', 'session_replaced')
              response.cookies.delete(APP_SESSION_NONCE_COOKIE)
              response.cookies.delete(CURRENT_TENANT_COOKIE)
              response.cookies.delete(SESSION_SNAPSHOT_COOKIE)
              response.cookies.delete(IMPERSONATION_SESSION_COOKIE)
              return response
            }
          } else {
            const [{ data: memberships }, valid] = await Promise.all([
              supabase
                .from('tenant_memberships')
                .select('id')
                .eq('user_id', user.id)
                .eq('status', 'active')
                .limit(1),
              isAppSessionValid(supabase, user.id, nonce)
            ])
            hasStaffMembership = (memberships?.length ?? 0) > 0
            if (hasStaffMembership && valid) {
              isAuthenticated = true
              isPartnerUser = false
            } else {
              await supabase.auth.signOut()
              return redirectTo(request, '/ceges-belepes')
            }
          }
        }
      } else {
        const nonce = request.cookies.get(APP_SESSION_NONCE_COOKIE)?.value
        const snapshotToken = request.cookies.get(SESSION_SNAPSHOT_COOKIE)
          ?.value
        const snap = await snapshotMatchesRequest({
          token: snapshotToken,
          userId: user.id,
          nonce
        })

        // Snapshot + nonce↔DB: remove/disable azonnal érvényesüljön (ne 15 perc stale)
        if (snap) {
          const valid = await isAppSessionValid(supabase, user.id, nonce)
          if (valid) {
            isAuthenticated = true
            hasStaffMembership = snap.hasMembership
            isPartnerUser = false
          } else {
            await supabase.auth.signOut()
            const response = redirectTo(request, '/login', 'session_replaced')
            response.cookies.delete(APP_SESSION_NONCE_COOKIE)
            response.cookies.delete(CURRENT_TENANT_COOKIE)
            response.cookies.delete(SESSION_SNAPSHOT_COOKIE)
            response.cookies.delete(IMPERSONATION_SESSION_COOKIE)
            return response
          }
        } else {
          const [{ data: partnerRow }, { data: memberships }] =
            await Promise.all([
              supabase
                .from('partner_profiles')
                .select('user_id, status')
                .eq('user_id', user.id)
                .maybeSingle(),
              supabase
                .from('tenant_memberships')
                .select('id')
                .eq('user_id', user.id)
                .eq('status', 'active')
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
            const valid = await isAppSessionValid(supabase, user.id, nonce)

            if (valid) {
              isAuthenticated = true
            } else if (isPartnerUser && !hasStaffMembership) {
              isAuthenticated = true
            } else if (isPartnerSharedApi && isPartnerUser) {
              isAuthenticated = true
            } else if (isPartnerSharedApi) {
              await supabase.auth.signOut()
              const response = redirectTo(request, '/login', 'session_replaced')
              response.cookies.delete(APP_SESSION_NONCE_COOKIE)
              response.cookies.delete(CURRENT_TENANT_COOKIE)
              response.cookies.delete(SESSION_SNAPSHOT_COOKIE)
              response.cookies.delete(IMPERSONATION_SESSION_COOKIE)
              return response
            } else {
              await supabase.auth.signOut()
              const response = redirectTo(request, '/login', 'session_replaced')
              response.cookies.delete(APP_SESSION_NONCE_COOKIE)
              response.cookies.delete(CURRENT_TENANT_COOKIE)
              response.cookies.delete(SESSION_SNAPSHOT_COOKIE)
              response.cookies.delete(IMPERSONATION_SESSION_COOKIE)
              return response
            }
          }
        }
      }
    }
  } else if (isDevBypassEnabled()) {
    isAuthenticated = Boolean(
      request.cookies.get(DEV_SESSION_COOKIE)?.value
    )
    if (isAuthenticated) {
      hasStaffMembership = true
    }
  }

  if (!isAuthenticated && !isPublicAuth) {
    const loginPath =
      partnerCtx && !isStaffOnlyPath(pathname)
        ? PARTNER_LOGIN_PATH
        : partnerCtx && isStaffOnlyPath(pathname)
          ? '/ceges-belepes'
          : '/login'
    return redirectTo(request, loginPath)
  }

  // Staff session on partner marketing host → serve tenant app (no /partner rewrite)
  if (
    surface === 'partner' &&
    isAuthenticated &&
    hasStaffMembership &&
    !isPartnerUser
  ) {
    rewriteTarget = null
    surfaceLabel = 'staff'
    const prevCookies = supabaseResponse.cookies.getAll()
    supabaseResponse = buildResponse()
    for (const cookie of prevCookies) {
      supabaseResponse.cookies.set(cookie)
    }
  } else if (
    surface === 'partner' &&
    isStaffOnlyPath(pathname) &&
    !(isAuthenticated && hasStaffMembership)
  ) {
    return redirectTo(
      request,
      isAuthenticated && isPartnerUser ? PARTNER_HOME_PATH : '/ceges-belepes'
    )
  }

  const partnerHome = partnerHomePathname(surface)

  // Bejelentkezett partner a marketing főoldalon → app home
  if (
    isAuthenticated &&
    isPartnerUser &&
    surface === 'partner' &&
    (pathname === '/' || pathname === '')
  ) {
    return redirectTo(request, partnerHome)
  }

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
      pathname === PARTNER_FORGOT_PASSWORD_PATH ||
      pathname === '/partner/login' ||
      pathname === '/partner/register' ||
      pathname === '/partner/elfelejtett-jelszo' ||
      pathname === '/login' ||
      pathname === '/ceges-belepes')
  ) {
    if (hasStaffMembership && !isPartnerUser) {
      return redirectTo(request, '/home')
    }
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
