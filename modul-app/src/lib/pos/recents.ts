import type { SaleProductSearchItem } from '@/lib/sales/queries'

const MAX_RECENT = 8
const PREFIX = 'modul-pos-recent'

export type PosRecentEntry = {
  id: string
  name: string
  sku: string
  price_net: number
  tax_rate_percent: number
  unit_shortform: string
  on_hand: number
  image_url: string | null
  at: number
}

function storageKey(tenantHint: string, registerId: string) {
  return `${PREFIX}:${tenantHint || 't'}:${registerId || 'r'}`
}

export function loadPosRecents(
  tenantHint: string,
  registerId: string
): PosRecentEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKey(tenantHint, registerId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as PosRecentEntry[]
    if (!Array.isArray(parsed)) return []
    return parsed.slice(0, MAX_RECENT)
  } catch {
    return []
  }
}

export function pushPosRecent(
  tenantHint: string,
  registerId: string,
  hit: SaleProductSearchItem
): PosRecentEntry[] {
  if (typeof window === 'undefined') return []
  const entry: PosRecentEntry = {
    id: hit.id,
    name: hit.display_name?.trim() || hit.name,
    sku: hit.sku,
    price_net: hit.price_net,
    tax_rate_percent: hit.tax_rate_percent,
    unit_shortform: hit.unit_shortform,
    on_hand: hit.on_hand,
    image_url: hit.image_url,
    at: Date.now()
  }
  const prev = loadPosRecents(tenantHint, registerId).filter(
    (r) => r.id !== hit.id
  )
  const next = [entry, ...prev].slice(0, MAX_RECENT)
  try {
    window.localStorage.setItem(
      storageKey(tenantHint, registerId),
      JSON.stringify(next)
    )
  } catch {
    /* quota */
  }
  return next
}

export function recentToSearchItem(r: PosRecentEntry): SaleProductSearchItem {
  return {
    kind: 'product',
    id: r.id,
    name: r.name,
    display_name: r.name,
    sku: r.sku,
    price_net: r.price_net,
    tax_rate_percent: r.tax_rate_percent,
    unit_shortform: r.unit_shortform || 'db',
    on_hand: r.on_hand,
    image_url: r.image_url
  }
}
