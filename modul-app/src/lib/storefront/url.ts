export const STOREFRONT_HOME = '/bolt'
export const STOREFRONT_SEARCH = '/bolt/kereses'
export const STOREFRONT_CART = '/bolt/kosar'

/** A bolt kanonikus címe. hostMode: saját host (aldomain / saját domain), a kezdőlap `/`. */
export type SiteBase = {
  origin: string
  hostMode: boolean
}

export function storefrontBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3010'
  )
}

export function productPath(slug: string): string {
  return `/p/${encodeURIComponent(slug)}`
}

export function categoryPath(slug: string): string {
  return `/bolt/k/${encodeURIComponent(slug)}`
}

export function siteUrl(base: SiteBase, path: string): string {
  if (base.hostMode && (path === STOREFRONT_HOME || path.startsWith(`${STOREFRONT_HOME}#`))) {
    return `${base.origin}/${path.slice(STOREFRONT_HOME.length)}`
  }
  return `${base.origin}${path}`
}

export function slugifyHu(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}
