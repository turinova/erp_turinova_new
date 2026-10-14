import type { SaleProductSearchItem } from '@/lib/sales/queries'

export type PosBarcodeLookupClientResult =
  | { ok: true; product: SaleProductSearchItem; fromCache?: boolean }
  | { ok: false; message: string; notFound?: boolean }

type CacheEntry = {
  at: number
  product: SaleProductSearchItem
}

const TTL_MS = 10 * 60 * 1000
const MAX_ENTRIES = 100
const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<PosBarcodeLookupClientResult>>()

function cacheKey(code: string, warehouseId: string) {
  return `${warehouseId}|${code.trim().toUpperCase()}`
}

function pruneCache() {
  if (cache.size <= MAX_ENTRIES) return
  const entries = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)
  for (const [k] of entries.slice(0, cache.size - MAX_ENTRIES)) {
    cache.delete(k)
  }
}

/** Session LRU peek — only for exact barcode path (never typeahead). */
export function peekPosBarcodeCache(
  code: string,
  warehouseId: string
): SaleProductSearchItem | null {
  const key = cacheKey(code, warehouseId)
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(key)
    return null
  }
  return hit.product
}

export function rememberPosBarcodeHit(
  code: string,
  warehouseId: string,
  product: SaleProductSearchItem
) {
  if ((product.kind ?? 'product') !== 'product') return
  const key = cacheKey(code, warehouseId)
  cache.set(key, { at: Date.now(), product })
  pruneCache()
}

export function forgetPosBarcodeHit(code: string, warehouseId: string) {
  cache.delete(cacheKey(code, warehouseId))
}

export function clearPosBarcodeCache() {
  cache.clear()
  inflight.clear()
}

/**
 * Exact POS barcode fetch with single-flight + LRU write.
 * Does not read cache (caller may optimistic-peek separately).
 */
export async function fetchPosBarcodeLookupCached(
  code: string,
  warehouseId: string
): Promise<PosBarcodeLookupClientResult> {
  const trimmed = code.trim()
  if (!trimmed) {
    return { ok: false, message: 'Üres vonalkód.', notFound: true }
  }
  if (!warehouseId) {
    return { ok: false, message: 'Válaszd ki a raktárat.' }
  }

  const key = cacheKey(trimmed, warehouseId)
  const existing = inflight.get(key)
  if (existing) return existing

  const promise = (async (): Promise<PosBarcodeLookupClientResult> => {
    const sp = new URLSearchParams({ q: trimmed, warehouseId })
    const res = await fetch(`/api/pos/barcode-lookup?${sp.toString()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin'
    })
    const data = (await res.json()) as
      | { ok: true; product: SaleProductSearchItem }
      | { ok: false; message: string; notFound?: boolean }

    if (!res.ok || !data.ok) {
      if ('ok' in data && data.ok === false) {
        forgetPosBarcodeHit(trimmed, warehouseId)
        return {
          ok: false,
          message: data.message || 'Vonalkód nem található.',
          notFound: data.notFound ?? res.status === 404
        }
      }
      return { ok: false, message: 'Vonalkód keresés sikertelen.' }
    }

    rememberPosBarcodeHit(trimmed, warehouseId, data.product)
    return { ok: true, product: data.product }
  })()

  inflight.set(key, promise)
  try {
    return await promise
  } finally {
    inflight.delete(key)
  }
}
