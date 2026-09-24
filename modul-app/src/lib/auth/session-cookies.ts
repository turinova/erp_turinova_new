import { cookies } from 'next/headers'

import {
  APP_SESSION_NONCE_COOKIE,
  CURRENT_TENANT_COOKIE,
  DEV_SESSION_COOKIE,
  IMPERSONATION_SESSION_COOKIE,
  OPERATOR_REFRESH_COOKIE,
  SESSION_SNAPSHOT_COOKIE,
  SESSION_SNAPSHOT_TTL_SEC,
  isDevBypassEnabled
} from '@/lib/auth/config'

/** Rövid életű cookie: Safari-biztos GET bootstrap a login után. */
export const LOGIN_PENDING_NONCE_COOKIE = 'modul_login_pending_nonce'
export const LOGIN_PENDING_SNAP_COOKIE = 'modul_login_pending_snap'
export const LOGIN_PENDING_NEXT_COOKIE = 'modul_login_pending_next'
export const LOGIN_PENDING_TENANT_COOKIE = 'modul_login_pending_tenant'

export type SessionKickReason =
  | 'nonce_missing'
  | 'nonce_mismatch'
  | 'session_row_missing'
  | 'session_check_error'
  | 'auth_cookie_missing'
  | 'session_replaced'

const KICK_REASONS = new Set<string>([
  'nonce_missing',
  'nonce_mismatch',
  'session_row_missing',
  'session_check_error',
  'auth_cookie_missing',
  'session_replaced'
])

export function parseSessionKickReason(
  raw: string | undefined | null
): SessionKickReason | null {
  if (!raw) return null
  if (KICK_REASONS.has(raw)) return raw as SessionKickReason
  return null
}

export function sessionKickMessage(reason: SessionKickReason): string {
  switch (reason) {
    case 'nonce_missing':
      return 'A munkamenet cookie hiányzik (gyakori Safari / régi cookie esetén). Töröld az oldal adatait, vagy próbáld privát ablakban, majd lépj be újra.'
    case 'nonce_mismatch':
      return 'A munkamenet lejárt, vagy ezzel a fiókkal máshol is beléptek. Egy fiók egyszerre egy gépen lehet bejelentkezve. Lépj be újra.'
    case 'session_row_missing':
      return 'A munkamenet érvénytelen (kijelentkezés vagy visszavonás után). Lépj be újra.'
    case 'session_check_error':
      return 'A munkamenet ellenőrzése sikertelen. Próbáld újra belépni.'
    case 'auth_cookie_missing':
      return 'A belépési session nem rögzült a böngészőben. Próbáld újra, vagy töröld az oldal cookie-jait.'
    case 'session_replaced':
    default:
      return 'A munkamenet lejárt vagy másik eszközön léptek be — esetleg a böngésző eldobta a session cookie-t. Lépj be újra.'
  }
}

export function isProductionSecureCookies() {
  return process.env.NODE_ENV === 'production'
}

/** Host-only, egységes attributumok — Safari delete/set egyezéshez. */
export function appSessionCookieOptions(maxAgeSec = 60 * 60 * 24 * 30) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: isProductionSecureCookies(),
    maxAge: maxAgeSec
  }
}

export function sessionSnapshotCookieOptions(
  maxAgeSec = SESSION_SNAPSHOT_TTL_SEC
) {
  return appSessionCookieOptions(maxAgeSec)
}

export function loginPendingCookieOptions(maxAgeSec = 120) {
  return appSessionCookieOptions(maxAgeSec)
}

/** MaxAge 0 + ugyanazok az attributumok — Safari stale peer törlés. */
export function expireCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: isProductionSecureCookies(),
    maxAge: 0
  }
}

const APP_AUTH_COOKIE_NAMES = [
  APP_SESSION_NONCE_COOKIE,
  SESSION_SNAPSHOT_COOKIE,
  CURRENT_TENANT_COOKIE,
  IMPERSONATION_SESSION_COOKIE,
  OPERATOR_REFRESH_COOKIE,
  LOGIN_PENDING_NONCE_COOKIE,
  LOGIN_PENDING_SNAP_COOKIE,
  LOGIN_PENDING_NEXT_COOKIE,
  LOGIN_PENDING_TENANT_COOKIE
] as const

type CookieSetter = {
  set: (
    name: string,
    value: string,
    options?: Record<string, unknown>
  ) => void
  delete?: (name: string) => void
}

/** Régi + pending cookie-k törlése (login / logout / kick). */
export function clearAppAuthCookies(store: CookieSetter) {
  const expired = expireCookieOptions()
  for (const name of APP_AUTH_COOKIE_NAMES) {
    try {
      store.set(name, '', expired)
    } catch {
      try {
        store.delete?.(name)
      } catch {
        // ignore
      }
    }
  }
  if (isDevBypassEnabled()) {
    try {
      store.set(DEV_SESSION_COOKIE, '', expired)
    } catch {
      try {
        store.delete?.(DEV_SESSION_COOKIE)
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Login előtt: csak a régi app session cookie-k (nem pending, nem sb-*).
 * Ne hívd signIn után — a sok Max-Age=0 elronthatja a Set-Cookie jar-t.
 */
export function clearStaleSessionCookies(store: CookieSetter) {
  const expired = expireCookieOptions()
  const names = [
    APP_SESSION_NONCE_COOKIE,
    SESSION_SNAPSHOT_COOKIE,
    CURRENT_TENANT_COOKIE,
    IMPERSONATION_SESSION_COOKIE,
    OPERATOR_REFRESH_COOKIE,
    LOGIN_PENDING_NONCE_COOKIE,
    LOGIN_PENDING_SNAP_COOKIE,
    LOGIN_PENDING_NEXT_COOKIE,
    LOGIN_PENDING_TENANT_COOKIE
  ] as const
  for (const name of names) {
    try {
      store.set(name, '', expired)
    } catch {
      try {
        store.delete?.(name)
      } catch {
        // ignore
      }
    }
  }
}

export async function clearAppAuthCookiesFromNext() {
  const store = await cookies()
  clearAppAuthCookies(store)
}

export function logSessionKick(input: {
  reason: SessionKickReason
  userId?: string | null
  host?: string | null
  ua?: string | null
}) {
  const uid = input.userId ? input.userId.slice(0, 8) : '—'
  console.warn(
    '[session-kick]',
    input.reason,
    `user=${uid}`,
    `host=${input.host ?? '—'}`,
    `ua=${(input.ua ?? '').slice(0, 80)}`
  )
}

/** Snapshot cookie Soft limit (Safari ~4KB / cookie). */
export const SNAPSHOT_COOKIE_WARN_BYTES = 3500
export const SNAPSHOT_COOKIE_MAX_BYTES = 3900
