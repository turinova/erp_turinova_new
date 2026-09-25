/**
 * Storefront host → bolt feloldás és kanonikus cím.
 * Edge-kompatibilis (middleware is használja): csak fetch, nincs Node API.
 *
 * Belső útvonal: /s/<tenant slug>/… — a middleware ide írja át a publikus
 * boltutakat, így az ISR cache kulcsa boltonként külön van.
 */

export const STOREFRONT_SITE_HEADER = 'x-storefront-site'
export const STOREFRONT_INTERNAL_PREFIX = '/s'

const RESERVED_LABELS = new Set([
  'www',
  'app',
  'admin',
  'partner',
  'api',
  'mail',
  'static',
  'cdn',
  'docs',
  'help',
  'status',
  'blog'
])

const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

export function storefrontRootDomain(): string | null {
  const env = process.env.STOREFRONT_ROOT_DOMAIN?.trim().toLowerCase()
  if (env) return env.replace(/^\.+|\.+$/g, '')
  return process.env.NODE_ENV === 'development' ? 'localhost' : null
}

function isLocalRoot(root: string | null): boolean {
  return root === 'localhost'
}

export function storefrontOriginForHost(host: string): string {
  if (isLocalRoot(storefrontRootDomain()) || host.endsWith('.localhost')) {
    return `http://${host}:${process.env.PORT || '3010'}`
  }
  return `https://${host}`
}

export function subdomainHostForSlug(slug: string): string | null {
  const root = storefrontRootDomain()
  if (!root || !DNS_LABEL.test(slug) || RESERVED_LABELS.has(slug)) return null
  return `${slug}.${root}`
}

export function demoSiteSlug(): string {
  return process.env.STOREFRONT_DEMO_TENANT_SLUG?.trim() || 'demo'
}

/** Publikus boltút (path-mód és storefront host közös). */
export function isStorefrontPublicPath(pathname: string): boolean {
  return (
    pathname === '/bolt' ||
    pathname.startsWith('/bolt/') ||
    pathname.startsWith('/p/') ||
    pathname === '/feeds/google.xml' ||
    pathname === '/feeds/openai.jsonl' ||
    pathname === '/llms.txt'
  )
}

/** Csak storefront hoston a gyökérből kiszolgált fájlok. */
export function isStorefrontRootFile(pathname: string): boolean {
  return (
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/indexnow.txt'
  )
}

export function internalStorefrontPath(site: string, pathname: string): string {
  const rest = pathname === '/' ? '/bolt' : pathname
  return `${STOREFRONT_INTERNAL_PREFIX}/${encodeURIComponent(site)}${rest}`
}

function appOwnedHosts(): Set<string> {
  const out = new Set(['localhost', '127.0.0.1', '0.0.0.0'])
  for (const key of [
    'NEXT_PUBLIC_APP_ORIGIN',
    'NEXT_PUBLIC_PARTNER_ORIGIN',
    'NEXT_PUBLIC_PLATFORM_ORIGIN',
    'NEXT_PUBLIC_APP_URL'
  ]) {
    const raw = process.env[key]?.trim()
    if (!raw) continue
    try {
      out.add(new URL(raw).hostname.toLowerCase())
    } catch {
      /* hibás env: kihagyjuk */
    }
  }
  return out
}

function isAppHost(host: string, root: string | null): boolean {
  if (appOwnedHosts().has(host)) return true
  if (host.endsWith('.vercel.app')) return true
  if (root && host === root) return true
  if (root && host.endsWith(`.${root}`)) {
    const label = host.slice(0, -(root.length + 1))
    return label.includes('.') || RESERVED_LABELS.has(label)
  }
  if (host.endsWith('.localhost')) return true
  if (host === 'optinova.hu' || host.endsWith('.optinova.hu')) return true
  return false
}

export type ResolvedStorefrontHost = { site: string; primaryHost: string }

type CacheEntry = { value: ResolvedStorefrontHost | null; expires: number }
const hostCache = new Map<string, CacheEntry>()
const HIT_TTL_MS = 60_000
const MISS_TTL_MS = 30_000
const CACHE_MAX = 2000

async function callResolveRpc(
  host: string,
  root: string | null
): Promise<ResolvedStorefrontHost | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  try {
    const res = await fetch(`${url}/rest/v1/rpc/storefront_resolve_host`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_host: host, p_root: root ?? '' }),
      cache: 'no-store',
      signal: AbortSignal.timeout(2500)
    })
    if (!res.ok) return null
    const rows = (await res.json()) as { site: string; primary_host: string }[]
    const row = rows?.[0]
    return row?.site ? { site: row.site, primaryHost: row.primary_host } : null
  } catch {
    return null
  }
}

/** null → nem storefront host (a normál app-folyam fut tovább). */
export async function resolveStorefrontHost(
  host: string
): Promise<ResolvedStorefrontHost | null> {
  const root = storefrontRootDomain()
  if (isAppHost(host, root)) return null

  const now = Date.now()
  const hit = hostCache.get(host)
  if (hit && hit.expires > now) return hit.value

  const value = await callResolveRpc(host, root)
  if (hostCache.size >= CACHE_MAX) hostCache.clear()
  hostCache.set(host, { value, expires: now + (value ? HIT_TTL_MS : MISS_TTL_MS) })
  return value
}
