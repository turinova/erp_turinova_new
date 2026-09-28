/**
 * Bolt kereső (doc 42): értelmezés → storefront_search_v2 → kártyák.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { loadCards, type StorefrontCard } from '@/lib/storefront/catalog'
import type { StorefrontCategory } from '@/lib/storefront/shell'

import { loadSearchDictionary } from './dictionary'
import { understandQuery, type SearchIntent, type UnderstoodQuery } from './understand'

/** storefront_search_v2 belső plafonja. */
const RPC_MAX = 200

export type SearchCategoryHit = { id: string; name: string; slug: string; count: number }

export type SearchResult = {
  items: StorefrontCard[]
  total: number
  /** Nem minden szóra volt találat — a legközelebbiek jönnek. */
  relaxed: boolean
  corrected: string | null
  intent: SearchIntent | null
  categories: SearchCategoryHit[]
  /** Pontos cikkszám/EAN egyezés egyetlen termékre → egyből a termékoldal. */
  exactSlug: string | null
  understood: UnderstoodQuery
}

type Row = {
  accessory_id: string
  category_id: string | null
  score: number
  matched: number
  code_hit: boolean
  groups: number
  best_matched: number
  total_count: number
  category_count: number
}

const EMPTY_UNDERSTOOD: UnderstoodQuery = {
  raw: '',
  norm: '',
  groups: [],
  codes: [],
  corrected: null,
  categoryIds: [],
  intent: null
}

function emptyResult(understood: UnderstoodQuery = EMPTY_UNDERSTOOD): SearchResult {
  return {
    items: [],
    total: 0,
    relaxed: false,
    corrected: understood.corrected,
    intent: understood.intent,
    categories: [],
    exactSlug: null,
    understood
  }
}

export async function runSearch(
  admin: SupabaseClient,
  tenantId: string,
  categories: StorefrontCategory[],
  q: string,
  opts: { limit: number; offset?: number; exact?: boolean }
): Promise<SearchResult> {
  const term = q.trim().slice(0, 120)
  if (!term) return emptyResult()

  const dict = await loadSearchDictionary(admin, tenantId)
  const understood = understandQuery(term, dict, categories, { exact: opts.exact })
  if (understood.groups.length === 0 && understood.codes.length === 0) {
    return emptyResult(understood)
  }

  const limit = Math.max(1, Math.min(opts.limit, RPC_MAX))
  const { data, error } = await admin.rpc('storefront_search_v2', {
    p_tenant: tenantId,
    p_groups: understood.groups,
    p_codes: understood.codes,
    p_norm: understood.norm,
    p_categories: understood.categoryIds,
    p_limit: limit,
    p_offset: opts.offset ?? 0
  })
  if (error) {
    console.error('storefront_search_v2', error.message)
    return emptyResult(understood)
  }
  const rows = (data ?? []) as Row[]
  const first = rows[0]
  const items = await loadCards(
    admin,
    tenantId,
    rows.map((r) => r.accessory_id)
  )

  const catById = new Map(categories.map((c) => [c.id, c]))
  const catCounts = new Map<string, number>()
  for (const r of rows) {
    if (r.category_id && catById.has(r.category_id)) {
      catCounts.set(r.category_id, Number(r.category_count))
    }
  }
  const hits = [...catCounts.entries()]
    .map(([id, count]) => {
      const c = catById.get(id)!
      return { id, name: c.name, slug: c.slug, count }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  const codeHits = rows.filter((r) => r.code_hit)
  const exactSlug =
    codeHits.length === 1 && (opts.offset ?? 0) === 0
      ? (items.find((i) => i.id === codeHits[0].accessory_id)?.slug ?? null)
      : null

  return {
    items,
    total: Number(first?.total_count ?? 0),
    relaxed: first != null && first.groups > 1 && first.best_matched < first.groups && !first.code_hit,
    corrected: understood.corrected,
    intent: understood.intent,
    categories: hits,
    exactSlug,
    understood
  }
}
