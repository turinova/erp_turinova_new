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
  isPartnerPublicPath,
  normalizeHostname,
  PARTNER_HOME_PATH,
  PARTNER_LOGIN_PATH,
  PARTNER_REGISTER_PATH,
  resolveAuthSurface
} from '@/lib/auth/surface'

function nextWithPathname(request: NextRequest, pathname: string) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)
  const partnerCtx = isPartnerContext(
    request.headers.get('host') ?? '',
    pathname
  )
  requestHeaders.set('x-modul-surface', partnerCtx ? 'partner' : 'staff')
  return NextResponse.next({
    request: { headers: requestHeaders }
  })
}

function redirectTo(request: NextRequest, pathname: string, reason?: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  if (reason) {
    url.searchParams.set('reason', reason)
  } else {
    url.searchParams.delete('reason')
  }
  return NextResponse.redirect(url)
}

/** Partner host: tiszta URL-ek → /partner/* */
function partnerHostCanonicalRedirect(
  request: NextRequest,
  surface: ReturnType<typeof resolveAuthSurface>,
  pathname: string
): NextResponse | null {
  if (surface !== 'partner') return null

  if (pathname === '/login') {
    return redirectTo(request, PARTNER_LOGIN_PATH)
  }
  if (pathname === '/register') {
    return redirectTo(request, PARTNER_REGISTER_PATH)
  }
  if (pathname === '/' || pathname === '') {
    return redirectTo(request, PARTNER_HOME_PATH)
  }

  const staffOnly =
    pathname.startsWith('/home') ||
    pathname.startsWith('/platform') ||
    pathname.startsWith('/ajanlatok') ||
    pathname.startsWith('/megrendelesek') ||
    pathname.startsWith('/opti') ||
    pathname.startsWith('/ugyfelek') ||
    pathname.startsWith('/torzsadatok') ||
    pathname.startsWith('/beallitasok') ||
    pathname.startsWith('/kereso') ||
    pathname === '/no-access' ||
    pathname === '/nincs-hozzaferes'

  if (staffOnly) {
    return redirectTo(request, PARTNER_LOGIN_PATH)
  }

  return null
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const hostname = normalizeHostname(request.headers.get('host'))
  const surface = resolveAuthSurface(hostname)

  const canonical = partnerHostCanonicalRedirect(request, surface, pathname)
  if (canonical) return canonical

  const partnerCtx = isPartnerContext(hostname, pathname)
  let supabaseResponse = nextWithPathname(request, pathname)

  const isStaffLogin = pathname === '/login'
  const isPartnerPublic = isPartnerPublicPath(pathname)
  const isPublicPartnerApi =
    pathname === '/api/partner/companies' ||
    pathname.startsWith('/api/partner/companies/')
  const isPublicAuthPage = isStaffLogin || isPartnerPublic || isPublicPartnerApi

  const isPublicAsset =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')

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
            supabaseResponse = nextWithPathname(request, pathname)
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

    // Staff + partner közös compute API-k (pl. Opti). Localhost staff hoston
    // a /partner/* oldalról hívva partnerCtx=false lenne path alapján.
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
        } else if (!isPartnerPublic) {
          // Auth van, de nincs partner profil → login
          await supabase.auth.signOut()
          return redirectTo(request, PARTNER_LOGIN_PATH)
        }
        // Public auth page + orphan session: maradhat a login/register
      } else {
        const nonce = request.cookies.get(APP_SESSION_NONCE_COOKIE)?.value
        const valid = await isAppSessionValid(supabase, user.id, nonce)

        if (valid) {
          isAuthenticated = true
        } else if (isPartnerSharedApi) {
          // Partner session a staff hoston — ne dobjuk ki a seat-nonce hiány miatt
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
    const devSession = request.cookies.get(DEV_SESSION_COOKIE)?.value
    isAuthenticated = Boolean(devSession)
  }

  if (!isAuthenticated && !isPublicAuthPage) {
    return redirectTo(request, partnerCtx ? PARTNER_LOGIN_PATH : '/login')
  }

  if (isAuthenticated && isStaffLogin) {
    return redirectTo(request, '/home')
  }

  if (isAuthenticated && isPartnerPublic) {
    return redirectTo(request, PARTNER_HOME_PATH)
  }

  return supabaseResponse
}
