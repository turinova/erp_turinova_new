import { storefrontRootDomain } from '@/lib/storefront/site'

/** Második szintű publikus végződések, ahol a „fő domain” 3 tagú (pl. ceg.co.hu). */
const SECOND_LEVEL_SUFFIXES = new Set([
  'co.hu',
  'org.hu',
  'info.hu',
  'priv.hu',
  'tm.hu',
  'shop.hu',
  'bolt.hu',
  'sport.hu',
  'hotel.hu',
  'ingatlan.hu',
  'media.hu',
  'utazas.hu',
  'co.uk',
  'org.uk',
  'com.au',
  'co.at',
  'com.ro'
])

const HOST_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

const PLATFORM_HOSTS = ['optinova.hu', 'turinova.hu', 'vercel.app']

export type NormalizedDomain =
  | { ok: true; hostname: string; apex: string; isApex: boolean }
  | { ok: false; message: string }

export function splitDomain(hostname: string): { apex: string; isApex: boolean } {
  const parts = hostname.split('.')
  const lastTwo = parts.slice(-2).join('.')
  const size = SECOND_LEVEL_SUFFIXES.has(lastTwo) ? 3 : 2
  const apex = parts.slice(-size).join('.')
  return { apex, isApex: apex === hostname }
}

/** Relatív név a DNS-zónában: '@' a fő domainre, különben az előtag (pl. 'www', 'bolt'). */
export function relativeName(fqdn: string, apex: string): string {
  if (fqdn === apex) return '@'
  return fqdn.endsWith(`.${apex}`) ? fqdn.slice(0, -(apex.length + 1)) : fqdn
}

/** „https://www.Cegem.hu/bolt” → „cegem.hu”. */
export function normalizeDomainInput(raw: string): NormalizedDomain {
  let s = raw.trim().toLowerCase()
  if (!s) return { ok: false, message: 'Írd be a domained, például: cegem.hu' }
  if (s.includes('@')) {
    return { ok: false, message: 'Ez e-mail címnek tűnik. Csak a domain kell, például: cegem.hu' }
  }
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
  s = s.split(/[/?#\s]/)[0] ?? ''
  s = s.replace(/:\d+$/, '').replace(/\.+$/, '')
  try {
    s = new URL(`http://${s}`).hostname
  } catch {
    return { ok: false, message: 'Ez nem domainnek tűnik. Példa: cegem.hu' }
  }
  if (s.startsWith('www.')) s = s.slice(4)

  if (!s.includes('.')) {
    return { ok: false, message: 'Hiányzik a végződés. Például: cegem.hu vagy cegem.com' }
  }
  if (!HOST_RE.test(s)) {
    return { ok: false, message: 'Ez nem domainnek tűnik. Csak betű, szám, kötőjel és pont lehet benne.' }
  }
  const root = storefrontRootDomain()
  if (
    (root && (s === root || s.endsWith(`.${root}`))) ||
    PLATFORM_HOSTS.some((h) => s === h || s.endsWith(`.${h}`))
  ) {
    return { ok: false, message: 'Ez a mi címünk, ezt nem kell bekötni. A saját, megvásárolt domained írd be.' }
  }
  const { apex, isApex } = splitDomain(s)
  return { ok: true, hostname: s, apex, isApex }
}
