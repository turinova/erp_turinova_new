/**
 * Bolt-szótár a lekérdezés-értelmezéshez: szókincs, szinonimák, kategória-szűrő
 * értékek, népszerű keresések. Tenantonként gyorsítótárazva (példányonként).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { slugifyHu } from '@/lib/storefront/url'
import { formatSpecNumber } from '@/lib/webshop/key-specs'
import type { CategoryTemplateItem } from '@/lib/webshop/types'

import { normSearch, numKey } from './normalize'

const TTL_MS = 120_000
const ERROR_TTL_MS = 20_000

export type SearchAttr = {
  id: string
  name: string
  code: string
  valueType: 'number' | 'list'
  unit: string | null
}

export type SearchFacetValue = {
  key: string
  label: string
  norm: string
  num: number | null
  count: number
}

export type SearchDictionary = {
  terms: Map<string, number>
  /** normalizált szó → ékezetes alak („fogantyu” → „fogantyú”). */
  surface: Map<string, string>
  /** Rendezett szókincs — előtag-kereséshez. */
  sortedTerms: string[]
  synonymSets: string[][]
  synonymsOf: Map<string, number[]>
  attrs: Map<string, SearchAttr>
  templates: Map<string, CategoryTemplateItem[]>
  /** kategória → jellemző → érték kulcs → érték (csak a kategória saját termékei). */
  values: Map<string, Map<string, Map<string, SearchFacetValue>>>
  popular: { norm: string; q: string; count: number }[]
}

type Raw = {
  terms?: [string, number, string][]
  synonyms?: string[][]
  attrs?: { id: string; name: string; code: string | null; type: string; unit: string | null }[]
  templates?: [string, string, string, number][]
  values?: [string, string, number | null, string | null, number][]
  popular?: [string, string, number][]
}

const EMPTY: SearchDictionary = {
  terms: new Map(),
  surface: new Map(),
  sortedTerms: [],
  synonymSets: [],
  synonymsOf: new Map(),
  attrs: new Map(),
  templates: new Map(),
  values: new Map(),
  popular: []
}

const cache = new Map<string, { at: number; ttl: number; value: Promise<SearchDictionary> }>()

function build(raw: Raw): SearchDictionary {
  const terms = new Map<string, number>()
  const surface = new Map<string, string>()
  for (const [t, f, s] of raw.terms ?? []) {
    terms.set(t, Number(f) || 1)
    if (s && s !== t) surface.set(t, s)
  }

  const synonymSets: string[][] = []
  const synonymsOf = new Map<string, number[]>()
  for (const set of raw.synonyms ?? []) {
    const clean = [...new Set(set.map((s) => normSearch(s)).filter((s) => s.length >= 2))]
    if (clean.length < 2) continue
    const idx = synonymSets.push(clean) - 1
    for (const s of clean) {
      const list = synonymsOf.get(s) ?? []
      list.push(idx)
      synonymsOf.set(s, list)
      if (!s.includes(' ') && !terms.has(s)) terms.set(s, 1)
    }
  }

  const attrs = new Map<string, SearchAttr>()
  for (const a of raw.attrs ?? []) {
    if (a.type !== 'number' && a.type !== 'list') continue
    attrs.set(a.id, {
      id: a.id,
      name: a.name,
      code: a.code ?? '',
      valueType: a.type,
      unit: a.unit
    })
  }

  const templates = new Map<string, CategoryTemplateItem[]>()
  for (const [categoryId, attributeId, role, sortOrder] of raw.templates ?? []) {
    const list = templates.get(categoryId) ?? []
    list.push({
      attributeId,
      role: role === 'spec' ? 'spec' : 'key',
      sortOrder: Number(sortOrder ?? 100)
    })
    templates.set(categoryId, list)
  }

  const values = new Map<string, Map<string, Map<string, SearchFacetValue>>>()
  for (const [categoryId, attrId, num, label, n] of raw.values ?? []) {
    const attr = attrs.get(attrId)
    if (!attr) continue
    let value: SearchFacetValue | null = null
    if (num != null && Number.isFinite(Number(num))) {
      const v = Number(num)
      value = {
        key: numKey(v),
        label: formatSpecNumber(v, attr.unit),
        norm: numKey(v),
        num: v,
        count: Number(n) || 0
      }
    } else if (label) {
      const norm = normSearch(label)
      if (!norm) continue
      value = { key: slugifyHu(label), label, norm, num: null, count: Number(n) || 0 }
    }
    if (!value) continue
    const byAttr = values.get(categoryId) ?? new Map<string, Map<string, SearchFacetValue>>()
    const byKey = byAttr.get(attrId) ?? new Map<string, SearchFacetValue>()
    const k = value.num != null ? value.key : value.norm
    const prev = byKey.get(k)
    byKey.set(k, prev ? { ...prev, count: prev.count + value.count } : value)
    byAttr.set(attrId, byKey)
    values.set(categoryId, byAttr)
  }

  return {
    terms,
    surface,
    sortedTerms: [...terms.keys()].sort(),
    synonymSets,
    synonymsOf,
    attrs,
    templates,
    values,
    popular: (raw.popular ?? []).map(([norm, q, count]) => ({ norm, q, count: Number(count) || 0 }))
  }
}

async function fetchDictionary(admin: SupabaseClient, tenantId: string): Promise<SearchDictionary> {
  const { data, error } = await admin.rpc('storefront_search_dictionary', { p_tenant: tenantId })
  if (error) {
    console.error('storefront_search_dictionary', error.message)
    throw error
  }
  return build((data ?? {}) as Raw)
}

export function loadSearchDictionary(
  admin: SupabaseClient,
  tenantId: string
): Promise<SearchDictionary> {
  const now = Date.now()
  const hit = cache.get(tenantId)
  if (hit && now - hit.at < hit.ttl) return hit.value
  const value = fetchDictionary(admin, tenantId).catch(() => {
    cache.set(tenantId, { at: Date.now(), ttl: ERROR_TTL_MS, value: Promise.resolve(EMPTY) })
    return EMPTY
  })
  cache.set(tenantId, { at: now, ttl: TTL_MS, value })
  return value
}

/** Admin mentés után: a következő keresés friss szinonimákkal fut. */
export function invalidateSearchDictionary(tenantId: string) {
  cache.delete(tenantId)
}

/** Van-e a szókincsben ezzel kezdődő szó (bináris keresés). */
export function hasTermPrefix(dict: SearchDictionary, prefix: string): boolean {
  const arr = dict.sortedTerms
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid] < prefix) lo = mid + 1
    else hi = mid
  }
  return lo < arr.length && arr[lo].startsWith(prefix)
}

/** A leggyakoribb, ezzel kezdődő szavak (automatikus kiegészítés). */
export function completeTerm(dict: SearchDictionary, prefix: string, limit: number): string[] {
  const arr = dict.sortedTerms
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid] < prefix) lo = mid + 1
    else hi = mid
  }
  const found: string[] = []
  for (let i = lo; i < arr.length && arr[i].startsWith(prefix) && found.length < 200; i++) {
    found.push(arr[i])
  }
  return found
    .sort((a, b) => (dict.terms.get(b) ?? 0) - (dict.terms.get(a) ?? 0))
    .slice(0, limit)
}
