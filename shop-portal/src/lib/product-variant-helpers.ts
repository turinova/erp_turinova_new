/**
 * Shared helpers for parent/child variant context (SEO, AI prompts, slugs).
 */

/** True if this row is a child variant (points to a real parent, not self). */
export function isChildVariant(
  parentProductId: string | null | undefined,
  productId: string
): boolean {
  return !!parentProductId && parentProductId !== productId
}

/** True if product acts as parent hub (no external parent, or self-reference). */
export function isParentHub(
  parentProductId: string | null | undefined,
  productId: string
): boolean {
  return !parentProductId || parentProductId === productId
}

function formatAttrValue(attr: any): string {
  if (!attr || attr.value === null || attr.value === undefined) return ''
  if (attr.type === 'LIST' && Array.isArray(attr.value)) {
    const parts = attr.value
      .map((val: any) => {
        if (typeof val === 'object' && val?.value != null) return String(val.value)
        if (typeof val === 'string') return val
        return null
      })
      .filter(Boolean)
    return parts.join(', ')
  }
  if (attr.type === 'TEXT' && Array.isArray(attr.value)) {
    const parts = attr.value
      .map((val: any) => {
        if (typeof val === 'object' && val?.value != null) return String(val.value)
        if (typeof val === 'string') return val
        return null
      })
      .filter(Boolean)
    return parts.join(', ')
  }
  return String(attr.value)
}

const PRIORITY_ATTR_NAMES = new Set([
  'meret',
  'szin',
  'size',
  'color',
  'teherbírás',
  'teherbiras',
  'Névleges hossz',
  'nevleges_hossz',
  'fiok_hossz',
  'model_number'
])

/**
 * Short human-readable differentiator for prompts (Hungarian-friendly labels).
 */
export function variantDifferentiatorFromAttributes(
  attributes: any[] | null | undefined,
  maxParts = 4
): string {
  if (!attributes || !Array.isArray(attributes)) return ''
  const parts: string[] = []
  const ordered = [...attributes].sort((a, b) => {
    const an = a?.name || ''
    const bn = b?.name || ''
    const ap = PRIORITY_ATTR_NAMES.has(an) ? 0 : 1
    const bp = PRIORITY_ATTR_NAMES.has(bn) ? 0 : 1
    if (ap !== bp) return ap - bp
    return an.localeCompare(bn)
  })
  for (const attr of ordered) {
    if (parts.length >= maxParts) break
    const display = attr.display_name || attr.name
    const val = formatAttrValue(attr)
    if (!val || val === 'N/A') continue
    parts.push(`${display}: ${val}`)
  }
  return parts.join('; ')
}

/**
 * ASCII slug token from variant attributes (for URL uniqueness). Lowercase, hyphens.
 */
export function slugTokensFromAttributes(attributes: any[] | null | undefined, maxLen = 32): string {
  const raw = variantDifferentiatorFromAttributes(attributes, 3)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  if (!raw) return ''
  return raw.length > maxLen ? raw.substring(0, maxLen).replace(/-$/, '') : raw
}

export type SearchQueryRow = {
  query: string
  impressions: number
  clicks: number
  ctr?: number
  position?: number
}

/**
 * Merge query lists, dedupe by query string, sort by impressions desc.
 */
export function mergeSearchQueriesByImpressions(
  ...lists: (SearchQueryRow[] | undefined)[]
): SearchQueryRow[] {
  const map = new Map<string, SearchQueryRow>()
  for (const list of lists) {
    if (!list) continue
    for (const row of list) {
      const q = (row.query || '').trim()
      if (!q) continue
      const prev = map.get(q.toLowerCase())
      if (!prev || row.impressions > prev.impressions) {
        map.set(q.toLowerCase(), {
          query: row.query,
          impressions: row.impressions || 0,
          clicks: row.clicks || 0,
          ctr: row.ctr ?? prev?.ctr,
          position: row.position ?? prev?.position
        })
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.impressions - a.impressions)
}

/** Pick rotating CTA index from stable string (e.g. SKU). */
export function ctaVariantIndex(seed: string, modulo: number): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0
  }
  return h % modulo
}
