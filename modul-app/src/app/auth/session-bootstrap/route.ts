import { NextResponse, type NextRequest } from 'next/server'

import {
  APP_SESSION_NONCE_COOKIE,
  CURRENT_TENANT_COOKIE,
  SESSION_SNAPSHOT_COOKIE
} from '@/lib/auth/config'
import {
  LOGIN_PENDING_NEXT_COOKIE,
  LOGIN_PENDING_NONCE_COOKIE,
  LOGIN_PENDING_SNAP_COOKIE,
  LOGIN_PENDING_TENANT_COOKIE,
  appSessionCookieOptions,
  expireCookieOptions,
  sessionSnapshotCookieOptions
} from '@/lib/auth/session-cookies'
import { loginPathForKick, resolveAuthSurface } from '@/lib/auth/surface'

/**
 * Safari-biztos session cookie set: GET válaszban állítjuk a hosszú életű
 * nonce + snapshot cookie-kat.
 *
 * Nem hív getUser()-t: a pending cookie-kat csak sikeres login után állítjuk
 * (120s TTL). A Server Action után a sb-* cookie gyakran még nincs a
 * következő GET-en — a getUser kapu téves session_replaced-et okozott.
 */
export async function GET(request: NextRequest) {
  const surface = resolveAuthSurface(request.headers.get('host') ?? 'localhost')
  const loginPath = loginPathForKick({ surface, kind: 'staff' })

  const pendingNonce = request.cookies.get(LOGIN_PENDING_NONCE_COOKIE)?.value
  const pendingSnap = request.cookies.get(LOGIN_PENDING_SNAP_COOKIE)?.value
  const pendingNext =
    request.cookies.get(LOGIN_PENDING_NEXT_COOKIE)?.value || '/home'
  const pendingTenant = request.cookies.get(LOGIN_PENDING_TENANT_COOKIE)?.value

  if (!pendingNonce) {
    const url = request.nextUrl.clone()
    url.pathname = loginPath
    url.searchParams.set('reason', 'nonce_missing')
    return NextResponse.redirect(url)
  }

  const response = NextResponse.redirect(
    new URL(sanitizeNext(pendingNext), request.url)
  )

  // Hosszú életű session cookie-k — GET response (Safari OK)
  response.cookies.set(
    APP_SESSION_NONCE_COOKIE,
    pendingNonce,
    appSessionCookieOptions()
  )
  if (pendingSnap) {
    response.cookies.set(
      SESSION_SNAPSHOT_COOKIE,
      pendingSnap,
      sessionSnapshotCookieOptions()
    )
  }
  if (pendingTenant) {
    response.cookies.set(
      CURRENT_TENANT_COOKIE,
      pendingTenant,
      appSessionCookieOptions()
    )
  } else {
    response.cookies.set(CURRENT_TENANT_COOKIE, '', expireCookieOptions())
  }

  // Pending egyszer használatos — második bootstrap → nonce_missing
  const expired = expireCookieOptions()
  response.cookies.set(LOGIN_PENDING_NONCE_COOKIE, '', expired)
  response.cookies.set(LOGIN_PENDING_SNAP_COOKIE, '', expired)
  response.cookies.set(LOGIN_PENDING_NEXT_COOKIE, '', expired)
  response.cookies.set(LOGIN_PENDING_TENANT_COOKIE, '', expired)

  return response
}

function sanitizeNext(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) return '/home'
  if (path.startsWith('/auth/')) return '/home'
  return path.slice(0, 200)
}
