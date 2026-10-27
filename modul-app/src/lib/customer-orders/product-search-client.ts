import type { PurchaseProductSearchItem } from '@/lib/purchase-orders/queries'

export type CsoProductSearchResponse =
  | { ok: true; rows: PurchaseProductSearchItem[] }
  | { ok: false; message: string }

/** Lean typeahead — `/api/cso/product-search` (AbortSignal támogatott). */
export async function fetchCsoProductSearch(
  q: string,
  opts?: { signal?: AbortSignal; limit?: number }
): Promise<CsoProductSearchResponse> {
  const term = q.trim()
  if (term.length < 2) return { ok: true, rows: [] }

  const sp = new URLSearchParams({
    q: term,
    limit: String(opts?.limit ?? 15)
  })
  try {
    const res = await fetch(`/api/cso/product-search?${sp.toString()}`, {
      method: 'GET',
      signal: opts?.signal,
      headers: { Accept: 'application/json' }
    })

    const body = (await res.json().catch(() => null)) as {
      rows?: PurchaseProductSearchItem[]
      error?: string
    } | null

    if (!res.ok) {
      return {
        ok: false,
        message: body?.error || 'Nem sikerült keresni a termékek között.'
      }
    }

    return { ok: true, rows: body?.rows ?? [] }
  } catch (err) {
    if (opts?.signal?.aborted) {
      return { ok: false, message: 'aborted' }
    }
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : 'Nem sikerült keresni a termékek között.'
    }
  }
}
