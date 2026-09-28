/**
 * Gépelés közbeni javaslatok: keresés-kiegészítés, kategóriák (doc 42 §4).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { loadCategories, type StorefrontCategory } from '@/lib/storefront/shell'

import { completeTerm, type SearchDictionary } from './dictionary'
import { normSearch, stemLite, STOPWORDS } from './normalize'

const CATEGORY_TTL_MS = 120_000
const MAX_QUERIES = 5
const MAX_CATEGORIES = 4

const categoryCache = new Map<string, { at: number; value: Promise<StorefrontCategory[]> }>()

/** Kategóriafa a javaslat API-hoz (példányonként 2 percig gyorsítótárazva). */
export function searchCategories(
  admin: SupabaseClient,
  tenantId: string
): Promise<StorefrontCategory[]> {
  const hit = categoryCache.get(tenantId)
  if (hit && Date.now() - hit.at < CATEGORY_TTL_MS) return hit.value
  const value = loadCategories(admin, tenantId).catch((e) => {
    console.error('searchCategories', e)
    categoryCache.delete(tenantId)
    return [] as StorefrontCategory[]
  })
  categoryCache.set(tenantId, { at: Date.now(), value })
  return value
}

export function suggestQueries(q: string, dict: SearchDictionary): string[] {
  const norm = normSearch(q)
  if (norm.length < 2) return []
  const tokens = norm.split(' ')
  const out = new Map<string, string>()

  for (const p of dict.popular) {
    if (out.size >= MAX_QUERIES) break
    if (p.norm === norm) continue
    const words = p.norm.split(' ')
    const all = tokens.every((t, i) =>
      i === tokens.length - 1 ? words.some((w) => w.startsWith(t)) : words.includes(t)
    )
    if (all) out.set(p.norm, p.q)
  }

  const last = tokens[tokens.length - 1]
  if (last.length >= 2 && !/^\d/.test(last)) {
    const head = q.trim().split(/\s+/).slice(0, -1).join(' ')
    for (const term of completeTerm(dict, last, MAX_QUERIES)) {
      if (out.size >= MAX_QUERIES) break
      if (term === last) continue
      const word = dict.surface.get(term) ?? term
      const text = head ? `${head} ${word}` : word
      const key = normSearch(text)
      if (!out.has(key)) out.set(key, text)
    }
  }
  return [...out.values()]
}

export function suggestCategories(
  q: string,
  categories: StorefrontCategory[],
  excludeId: string | null
): StorefrontCategory[] {
  const stems = normSearch(q)
    .split(' ')
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    .map(stemLite)
  if (stems.length === 0) return []
  return categories
    .filter((c) => c.productCount > 0 && c.id !== excludeId)
    .map((c) => {
      const words = normSearch(c.name).split(' ').map(stemLite)
      const hits = stems.filter((s) =>
        words.some((w) => w.startsWith(s) || (w.length >= 4 && s.startsWith(w)))
      )
      return { c, hits: hits.length }
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits || b.c.productCount - a.c.productCount)
    .slice(0, MAX_CATEGORIES)
    .map((x) => x.c)
}
