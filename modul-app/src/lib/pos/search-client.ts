import type { SaleProductSearchItem } from '@/lib/sales/queries'

export type PosSearchClientOpts = {
  inStockOnly?: boolean
  stockFirst?: boolean
  limit?: number
  kind?: 'all' | 'product' | 'sheet_material' | 'linear_material'
  includeMaterials?: boolean
  /** Skip LRU (bench / force refresh). */
  bypassCache?: boolean
}

export type PosSearchClientResult =
  | { ok: true; rows: SaleProductSearchItem[]; ms?: number; cached?: boolean }
  | { ok: false; message: string }

type CacheEntry = {
  at: number
  rows: SaleProductSearchItem[]
}

const TTL_MS = 45_000
const MAX_ENTRIES = 64
const cache = new Map<string, CacheEntry>()

function cacheKey(
  q: string,
  warehouseId: string,
  opts: PosSearchClientOpts
): string {
  return [
    warehouseId,
    q.trim().toLocaleLowerCase('hu'),
    opts.kind ?? 'all',
    opts.includeMaterials ? '1' : '0',
    opts.inStockOnly ? '1' : '0',
    opts.stockFirst === false ? '0' : '1',
    String(opts.limit ?? 15)
  ].join('|')
}

function pruneCache() {
  if (cache.size <= MAX_ENTRIES) return
  const entries = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)
  const drop = entries.slice(0, cache.size - MAX_ENTRIES)
  for (const [k] of drop) cache.delete(k)
}

/**
 * POS typeahead via GET /api/pos/search + short-lived LRU.
 * Replaces searchSaleProductsAction on the hot typing path.
 */
export async function searchPosProductsClient(
  q: string,
  warehouseId: string,
  opts?: PosSearchClientOpts
): Promise<PosSearchClientResult> {
  const term = q.trim()
  if (!term) return { ok: false, message: 'Üres keresés.' }
  if (!warehouseId) return { ok: false, message: 'Válaszd ki a raktárat.' }

  const key = cacheKey(term, warehouseId, opts ?? {})
  if (!opts?.bypassCache) {
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < TTL_MS) {
      return { ok: true, rows: hit.rows, cached: true, ms: 0 }
    }
  }

  const params = new URLSearchParams({
    q: term,
    warehouseId,
    stockFirst: opts?.stockFirst === false ? '0' : '1',
    limit: String(opts?.limit ?? 15),
    kind: opts?.kind ?? 'all'
  })
  if (opts?.inStockOnly) params.set('inStockOnly', '1')
  if (opts?.includeMaterials) params.set('includeMaterials', '1')

  const t0 = performance.now()
  let res: Response
  try {
    res = await fetch(`/api/pos/search?${params.toString()}`, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    })
  } catch {
    return { ok: false, message: 'Hálózati hiba a keresésnél.' }
  }

  const clientMs = Math.round(performance.now() - t0)
  let body: {
    ok?: boolean
    rows?: SaleProductSearchItem[]
    message?: string
    ms?: number
  }
  try {
    body = (await res.json()) as typeof body
  } catch {
    return { ok: false, message: 'Érvénytelen keresési válasz.' }
  }

  if (!res.ok || !body.ok) {
    return {
      ok: false,
      message: body.message || `Keresés sikertelen (${res.status}).`
    }
  }

  const rows = body.rows ?? []
  // Empty results: don't poison LRU (compound / typo miss after catalog fix)
  if (rows.length > 0) {
    cache.set(key, { at: Date.now(), rows })
    pruneCache()
  }

  return {
    ok: true,
    rows,
    ms: typeof body.ms === 'number' ? body.ms : clientMs,
    cached: false
  }
}

export function clearPosSearchCache() {
  cache.clear()
}
