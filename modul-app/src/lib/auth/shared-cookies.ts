/**
 * Régi, `Domain=.optinova.hu` szintű app cookie-k kezelése (edge-biztos, nincs next/headers).
 *
 * Korábban az impersonation `COOKIE_DOMAIN`-nel írta a nonce-ot → a host-only párja mellett
 * a böngésző mindkettőt küldi; a Safari sorrendje miatt a régi érték nyert (`nonce_mismatch`).
 * Host-only törlés nem éri el — csak ugyanazzal a Domain attribútummal lehet lejáratni.
 */
import {
  APP_SESSION_NONCE_COOKIE,
  CURRENT_TENANT_COOKIE,
  IMPERSONATION_SESSION_COOKIE,
  OPERATOR_REFRESH_COOKIE,
  SESSION_SNAPSHOT_COOKIE
} from '@/lib/auth/config'

export const SHARED_APP_COOKIE_NAMES = [
  APP_SESSION_NONCE_COOKIE,
  SESSION_SNAPSHOT_COOKIE,
  CURRENT_TENANT_COOKIE,
  IMPERSONATION_SESSION_COOKIE,
  OPERATOR_REFRESH_COOKIE
] as const

/** Egy cookie összes értéke a nyers Cookie fejlécből (a böngésző sorrendjében). */
export function cookieValues(header: string | null | undefined, name: string): string[] {
  if (!header) return []
  const out: string[] = []
  for (const pair of header.split(/; */)) {
    const at = pair.indexOf('=')
    if (at <= 0 || pair.slice(0, at) !== name) continue
    try {
      out.push(decodeURIComponent(pair.slice(at + 1)))
    } catch {
      out.push(pair.slice(at + 1))
    }
  }
  return out
}

/** App cookie nevek, amelyek többször érkeztek (host-only + domain példány). */
export function duplicatedAppCookies(header: string | null | undefined): string[] {
  return SHARED_APP_COOKIE_NAMES.filter((name) => cookieValues(header, name).length > 1)
}

/** Domainek, amelyeken régi példány lehet: `COOKIE_DOMAIN` + a host szülő-domainje. */
export function sharedCookieDomains(hostname: string | null | undefined): string[] {
  const host = (hostname ?? '').split(':')[0]!.trim().toLowerCase()
  const out = new Set<string>()
  const env = process.env.COOKIE_DOMAIN?.trim().toLowerCase()
  if (env && host && (host === env.replace(/^\./, '') || host.endsWith(env.startsWith('.') ? env : `.${env}`))) {
    out.add(env.startsWith('.') ? env : `.${env}`)
  }
  const labels = host.split('.')
  const isIp = /^[\d.]+$/.test(host) || host.includes(':')
  if (!isIp && labels.length >= 2 && labels.at(-1) !== 'localhost') {
    out.add(`.${labels.slice(-2).join('.')}`)
  }
  return [...out]
}

/**
 * Lejáratja a domain-szintű példányokat. A `ResponseCookies` név szerint tárol (egy név = egy
 * Set-Cookie), ezért nyers fejléccel fűzzük hozzá — minden `response.cookies.set` UTÁN hívd.
 */
export function expireSharedDomainCookies(
  headers: Headers,
  hostname: string | null | undefined,
  names: readonly string[] = SHARED_APP_COOKIE_NAMES
) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  for (const domain of sharedCookieDomains(hostname)) {
    for (const name of names) {
      headers.append(
        'Set-Cookie',
        `${name}=; Domain=${domain}; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${secure}`
      )
    }
  }
}
