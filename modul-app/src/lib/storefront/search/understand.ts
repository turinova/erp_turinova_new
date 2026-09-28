/**
 * Lekérdezés-értelmezés (doc 42 §2): elgépelés-javítás, szinonimák, mértékegységek,
 * kategória + szűrő felismerés („fekete fogantyú 128” → Fogantyúk · 128 mm · fekete).
 */

import { catalogHref } from '@/lib/storefront/catalog-params'
import { descendantIds, type StorefrontCategory } from '@/lib/storefront/shell'
import { categoryFacetPath, categoryPath, slugifyHu } from '@/lib/storefront/url'
import { resolveCategoryTemplate } from '@/lib/webshop/key-specs'

import { hasTermPrefix, type SearchAttr, type SearchDictionary, type SearchFacetValue } from './dictionary'
import {
  compactCode,
  editDistance,
  isNumberToken,
  normSearch,
  numKey,
  stemLite,
  STOPWORDS,
  UNIT_FACTORS
} from './normalize'

const MAX_GROUPS = 8
const MAX_ALTS = 8
const MAX_FACETS = 6

export type SearchIntentFacet = { param: string; value: string; name: string; label: string }

export type SearchIntent = {
  categoryId: string
  categoryName: string
  label: string
  href: string
  facets: SearchIntentFacet[]
}

export type UnderstoodQuery = {
  raw: string
  norm: string
  groups: string[][]
  codes: string[]
  /** Javított keresés megjelenítésre (ékezetes), ha volt javítás. */
  corrected: string | null
  /** Rangsor-erősítés: a felismert kategória és leszármazottai. */
  categoryIds: string[]
  intent: SearchIntent | null
}

type Item =
  | { kind: 'word'; text: string; original: string; corrected: boolean }
  | { kind: 'num'; value: number; unit: string | null }

function parseItems(tokens: string[]): Item[] {
  const items: Item[] = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (isNumberToken(t)) {
      const next = tokens[i + 1]
      if (next && UNIT_FACTORS[next]) {
        items.push({ kind: 'num', value: Number(t), unit: next })
        i++
      } else {
        items.push({ kind: 'num', value: Number(t), unit: null })
      }
      continue
    }
    if (t.length < 2 || STOPWORDS.has(t)) continue
    items.push({ kind: 'word', text: t, original: t, corrected: false })
  }
  return items
}

function mergePhrases(items: Item[], dict: SearchDictionary): Item[] {
  const out: Item[] = []
  for (let i = 0; i < items.length; i++) {
    const a = items[i]
    const b = items[i + 1]
    if (a.kind === 'word' && b?.kind === 'word') {
      const phrase = `${a.text} ${b.text}`
      if (dict.synonymsOf.has(phrase)) {
        out.push({ kind: 'word', text: phrase, original: phrase, corrected: false })
        i++
        continue
      }
    }
    out.push(a)
  }
  return out
}

function isKnown(dict: SearchDictionary, w: string): boolean {
  if (dict.terms.has(w) || dict.synonymsOf.has(w) || hasTermPrefix(dict, w)) return true
  const stem = stemLite(w)
  if (stem !== w && (dict.terms.has(stem) || hasTermPrefix(dict, stem))) return true
  for (let len = w.length - 1; len >= Math.max(4, w.length - 4); len--) {
    if (dict.terms.has(w.slice(0, len))) return true
  }
  return false
}

function correctWord(dict: SearchDictionary, w: string): string | null {
  if (w.length < 3 || w.includes(' ') || dict.terms.size === 0 || isKnown(dict, w)) return null
  const max = w.length <= 4 ? 1 : 2
  let best: string | null = null
  let bestDist = max + 1
  let bestFreq = 0
  for (const term of dict.sortedTerms) {
    if (Math.abs(term.length - w.length) > max && term.length < w.length) continue
    const full = editDistance(w, term, max)
    const prefix =
      term.length > w.length ? editDistance(w, term.slice(0, w.length), max) + 0.5 : max + 1
    const d = Math.min(full, prefix)
    if (d > max) continue
    const freq = dict.terms.get(term) ?? 0
    if (d < bestDist || (d === bestDist && freq > bestFreq)) {
      best = term
      bestDist = d
      bestFreq = freq
    }
  }
  return best
}

function synonymsFor(dict: SearchDictionary, w: string): string[] {
  const out = new Set<string>()
  for (const key of [w, stemLite(w)]) {
    for (const idx of dict.synonymsOf.get(key) ?? []) {
      for (const s of dict.synonymSets[idx]) out.add(s)
    }
  }
  out.delete(w)
  return [...out]
}

function numAlts(value: number, unit: string | null): string[] {
  const alts = [numKey(value)]
  if (unit) {
    const f = UNIT_FACTORS[unit]
    alts.unshift(`${numKey(value)} ${unit}`)
    if (f && f.factor !== 1) alts.push(numKey(value * f.factor))
  }
  return [...new Set(alts)]
}

// ---------------------------------------------------------------------------
// Kategória + szűrő felismerés
// ---------------------------------------------------------------------------

function stemsOf(text: string): string[] {
  return text
    .split(' ')
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !isNumberToken(w))
    .map(stemLite)
}

function stemMatch(categoryStem: string, queryStem: string): boolean {
  if (categoryStem === queryStem) return true
  if (queryStem.length >= 4 && categoryStem.startsWith(queryStem)) return true
  return categoryStem.length >= 4 && queryStem.startsWith(categoryStem)
}

function depthOf(categories: Map<string, StorefrontCategory>, id: string): number {
  let d = 0
  let cur = categories.get(id)
  while (cur?.parentId && d < 10) {
    d++
    cur = categories.get(cur.parentId)
  }
  return d
}

type CategoryHit = { category: StorefrontCategory; consumed: Set<number> }

function detectCategory(
  items: Item[],
  alts: string[][],
  categories: StorefrontCategory[]
): CategoryHit | null {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const itemStems = items.map((it, i) =>
    it.kind === 'word' ? new Set(alts[i].flatMap((a) => stemsOf(a))) : new Set<string>()
  )
  let best: { hit: CategoryHit; score: number } | null = null
  for (const c of categories) {
    if (c.productCount <= 0) continue
    const words = stemsOf(normSearch(c.name))
    if (words.length === 0) continue
    const consumed = new Set<number>()
    let matched = 0
    for (const cw of words) {
      const idx = itemStems.findIndex(
        (stems, i) => !consumed.has(i) && [...stems].some((qs) => stemMatch(cw, qs))
      )
      if (idx >= 0) {
        consumed.add(idx)
        matched++
      }
    }
    if (matched === 0) continue
    const ratio = matched / words.length
    if (ratio < 0.5) continue
    const score = ratio * 10 + matched + depthOf(byId, c.id) * 0.1 + Math.log10(1 + c.productCount) * 0.05
    if (!best || score > best.score) best = { hit: { category: c, consumed }, score }
  }
  return best?.hit ?? null
}

function facetAttrsOf(
  dict: SearchDictionary,
  categories: StorefrontCategory[],
  categoryId: string
): SearchAttr[] {
  const resolved = resolveCategoryTemplate(
    categories.map((c) => ({
      id: c.id,
      name: c.name,
      parentId: c.parentId,
      measureImageUrl: null,
      template: dict.templates.get(c.id) ?? []
    })),
    categoryId
  )
  return resolved.items
    .map((t) => dict.attrs.get(t.attributeId))
    .filter((a): a is SearchAttr => a != null)
    .slice(0, MAX_FACETS)
}

function subtreeValues(
  dict: SearchDictionary,
  ids: string[],
  attrId: string
): Map<string, SearchFacetValue> {
  const out = new Map<string, SearchFacetValue>()
  for (const id of ids) {
    for (const [k, v] of dict.values.get(id)?.get(attrId) ?? []) {
      const prev = out.get(k)
      out.set(k, prev ? { ...prev, count: prev.count + v.count } : v)
    }
  }
  return out
}

function numberCandidates(value: number, unit: string | null, attrUnit: string | null): string[] {
  if (!unit) return [numKey(value)]
  const from = UNIT_FACTORS[unit]
  const to = attrUnit ? UNIT_FACTORS[attrUnit.toLowerCase()] : undefined
  if (from && to && from.base === to.base) return [numKey((value * from.factor) / to.factor)]
  if (attrUnit && attrUnit.toLowerCase() === unit) return [numKey(value)]
  return []
}

function facetParamOf(attr: SearchAttr): string {
  return slugifyHu(attr.code || attr.name) || attr.id.slice(0, 8)
}

function detectFacets(
  items: Item[],
  consumed: Set<number>,
  dict: SearchDictionary,
  categories: StorefrontCategory[],
  categoryId: string
): { facets: SearchIntentFacet[]; used: Set<number> } {
  const attrs = facetAttrsOf(dict, categories, categoryId)
  const ids = descendantIds(categories, categoryId)
  const facets: SearchIntentFacet[] = []
  const used = new Set<number>()
  const normTokens = items.map((it) => (it.kind === 'word' ? it.text : ''))

  for (const attr of attrs) {
    const values = subtreeValues(dict, ids, attr.id)
    if (values.size === 0) continue
    let hit: { v: SearchFacetValue; idx: number[] } | null = null

    if (attr.valueType === 'number') {
      for (let i = 0; i < items.length && !hit; i++) {
        const it = items[i]
        if (it.kind !== 'num' || used.has(i) || consumed.has(i)) continue
        for (const key of numberCandidates(it.value, it.unit, attr.unit)) {
          const v = values.get(key)
          if (v) {
            hit = { v, idx: [i] }
            break
          }
        }
      }
    } else {
      const sorted = [...values.values()].sort((a, b) => b.norm.length - a.norm.length)
      for (const v of sorted) {
        const words = v.norm.split(' ')
        const idx: number[] = []
        for (const w of words) {
          const i = normTokens.findIndex(
            (t, j) =>
              t !== '' &&
              !used.has(j) &&
              !consumed.has(j) &&
              !idx.includes(j) &&
              (t === w || stemLite(t) === stemLite(w) || (t.length >= 4 && w.startsWith(t)))
          )
          if (i < 0) break
          idx.push(i)
        }
        if (idx.length === words.length) {
          hit = { v, idx }
          break
        }
      }
    }

    if (hit) {
      for (const i of hit.idx) used.add(i)
      facets.push({
        param: facetParamOf(attr),
        value: hit.v.key,
        name: attr.name,
        label: hit.v.label
      })
    }
  }
  return { facets, used }
}

function correctedDisplay(raw: string, fixes: Map<string, string>, dict: SearchDictionary): string {
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const fixed = fixes.get(normSearch(word))
      return fixed ? (dict.surface.get(fixed) ?? fixed) : word
    })
    .join(' ')
}

export function understandQuery(
  raw: string,
  dict: SearchDictionary,
  categories: StorefrontCategory[],
  opts: { exact?: boolean } = {}
): UnderstoodQuery {
  const q = raw.trim().slice(0, 120)
  const norm = normSearch(q)
  const tokens = norm.split(' ').filter(Boolean)

  const codes = new Set<string>()
  for (const piece of [q, ...q.split(/\s+/)]) {
    const c = compactCode(piece)
    if (c.length >= 4 && /\d/.test(c)) codes.add(c)
  }

  let items = mergePhrases(parseItems(tokens), dict)
  const fixes = new Map<string, string>()
  if (!opts.exact) {
    items = items.map((it) => {
      if (it.kind !== 'word') return it
      const fixed = correctWord(dict, it.text)
      if (!fixed) return it
      fixes.set(it.text, fixed)
      return { ...it, text: fixed, corrected: true }
    })
  }
  items = items.slice(0, MAX_GROUPS)

  const alts = items.map((it) =>
    it.kind === 'num'
      ? numAlts(it.value, it.unit)
      : [it.text, ...synonymsFor(dict, it.text)].slice(0, MAX_ALTS)
  )

  const cat = detectCategory(items, alts, categories)
  let intent: SearchIntent | null = null
  let categoryIds: string[] = []
  if (cat) {
    const { category } = cat
    categoryIds = descendantIds(categories, category.id)
    const { facets } = detectFacets(items, cat.consumed, dict, categories, category.id)
    const base = categoryPath(category.slug)
    const href =
      facets.length === 1
        ? categoryFacetPath(category.slug, facets[0].value)
        : facets.length > 1
          ? catalogHref(base, {}, Object.fromEntries(facets.map((f) => [f.param, f.value])))
          : base
    intent = {
      categoryId: category.id,
      categoryName: category.name,
      label: [category.name, ...facets.map((f) => f.label)].join(' · '),
      href,
      facets
    }
  }

  return {
    raw: q,
    norm: items.length > 0 ? norm : '',
    groups: alts.filter((a) => a.length > 0),
    codes: [...codes].slice(0, 6),
    corrected: fixes.size > 0 ? correctedDisplay(q, fixes, dict) : null,
    categoryIds,
    intent
  }
}
