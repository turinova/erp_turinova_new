'use client'

import { readLocal, useLocal, writeLocal } from '@/lib/storefront/local-store'

const VIEWED_KEY = 'bolt-latott-v1'
const SEARCH_KEY = 'bolt-keresesek-v1'
const MAX_VIEWED = 12
const MAX_SEARCHES = 6

export type ViewedItem = {
  id: string
  slug: string
  title: string
  imageUrl: string | null
  priceGross: number
}

const NO_VIEWS: ViewedItem[] = []
const NO_SEARCHES: string[] = []

export function useRecentlyViewed(): ViewedItem[] {
  return useLocal<ViewedItem[]>(VIEWED_KEY, NO_VIEWS)
}

export function recordView(item: ViewedItem) {
  const list = readLocal<ViewedItem[]>(VIEWED_KEY, NO_VIEWS)
  writeLocal(VIEWED_KEY, [item, ...list.filter((v) => v.id !== item.id)].slice(0, MAX_VIEWED))
}

export function useRecentSearches(): string[] {
  return useLocal<string[]>(SEARCH_KEY, NO_SEARCHES)
}

export function recordSearch(term: string) {
  const t = term.trim().slice(0, 80)
  if (t.length < 2) return
  const list = readLocal<string[]>(SEARCH_KEY, NO_SEARCHES)
  const key = t.toLocaleLowerCase('hu')
  writeLocal(
    SEARCH_KEY,
    [t, ...list.filter((s) => s.toLocaleLowerCase('hu') !== key)].slice(0, MAX_SEARCHES)
  )
}

export function clearRecentSearches() {
  writeLocal(SEARCH_KEY, NO_SEARCHES)
}
