'use client'

import { useEffect } from 'react'

import { ProductRail } from '@/components/storefront/product-grid'
import {
  recordSearch,
  recordView,
  useRecentlyViewed,
  type ViewedItem
} from '@/lib/storefront/recent'

export function RecordProductView({ item }: { item: ViewedItem }) {
  const { id, slug, title, imageUrl, priceGross } = item
  useEffect(() => {
    recordView({ id, slug, title, imageUrl, priceGross })
  }, [id, slug, title, imageUrl, priceGross])
  return null
}

export function RecordSearch({ term }: { term: string }) {
  useEffect(() => {
    recordSearch(term)
  }, [term])
  return null
}

const MIN_ITEMS = 2

/** Csak kliensen, a böngésző tárából — üresen semmit nem rajzol. */
export function RecentlyViewedRail({ excludeId }: { excludeId?: string }) {
  const items = useRecentlyViewed().filter((v) => v.id !== excludeId)
  if (items.length < MIN_ITEMS) return null
  return <ProductRail title="Nemrég megnézted" items={items.slice(0, 8)} />
}
