import type { CostItem } from "@/types"
import { getTradeLabel } from "@/lib/trades"
import { getCategoryMap } from "@/lib/data/categories-store"

const SYNONYMS: Record<string, string[]> = {
  bontás: ["bontas", "leszerelés", "leszereles", "demont"],
  elszállítás: ["elszallitas", "szállítás", "szallitas"],
  burkolás: ["burkolas", "burkolat"],
  nyílászáró: ["nyilaszaró", "nyilaszaro", "ablak", "ajtó", "ajto"],
  gépészet: ["gepeszet", "klíma", "klima", "fűtés", "futes"],
  elektromos: ["villany", "villanyszerelés"],
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

export function getSearchableText(item: CostItem): string {
  const category = getCategoryMap()[item.categoryId]?.name ?? ""
  return normalize(
    [
      item.identifier,
      item.text,
      item.shortLabel,
      ...item.tags,
      getTradeLabel(item.trade),
      category,
    ]
      .filter(Boolean)
      .join(" ")
  )
}

export function expandQueryTokens(query: string): string[] {
  const base = normalize(query)
    .split(/\s+/)
    .filter(Boolean)
  const expanded = new Set(base)
  for (const token of base) {
    for (const [key, syns] of Object.entries(SYNONYMS)) {
      if (token.includes(normalize(key)) || syns.some((s) => token.includes(s))) {
        expanded.add(normalize(key))
        syns.forEach((s) => expanded.add(s))
      }
    }
  }
  return [...expanded]
}

export function matchesFuzzySearch(item: CostItem, query: string): boolean {
  const q = query.trim()
  if (!q) return true
  const haystack = getSearchableText(item)
  const tokens = expandQueryTokens(q)
  return tokens.every((token) => haystack.includes(token))
}

export function tokenizeHighlight(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean)
}

export function getSimilarItems(items: CostItem[], candidate: CostItem, limit = 3): Array<{
  item: CostItem
  score: number
}> {
  const words = new Set(
    normalize(candidate.text)
      .split(/\s+/)
      .filter((w) => w.length > 3)
  )
  if (words.size === 0) return []

  return items
    .filter((i) => i.id !== candidate.id)
    .map((item) => {
      const itemWords = normalize(item.text).split(/\s+/).filter((w) => w.length > 3)
      let overlap = 0
      for (const w of itemWords) {
        if (words.has(w)) overlap++
      }
      const score = Math.round((overlap / Math.max(words.size, 1)) * 100)
      const identifierMatch = item.identifier === candidate.identifier ? 30 : 0
      return { item, score: Math.min(100, score + identifierMatch) }
    })
    .filter((r) => r.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
