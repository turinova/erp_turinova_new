'use client'

import { readLocal, useLocal, writeLocal } from '@/lib/storefront/local-store'

const CART_KEY = 'bolt-kosar-v1'
const MAX_LINES = 50
const MAX_QTY = 999

export type CartTier = { minQty: number; unitGross: number }

export type CartLine = {
  id: string
  slug: string
  title: string
  variantLabel: string | null
  imageUrl: string | null
  sku: string
  unitGross: number
  tiers: CartTier[]
  /** Ismert készlet a hozzáadáskor — felső korlát. */
  maxQty: number | null
  qty: number
}

const EMPTY: CartLine[] = []

export function useCart(): CartLine[] {
  return useLocal<CartLine[]>(CART_KEY, EMPTY)
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.qty, 0)
}

export function lineUnit(line: Pick<CartLine, 'unitGross' | 'tiers' | 'qty'>): number {
  let unit = line.unitGross
  for (const t of line.tiers) {
    if (line.qty >= t.minQty && t.unitGross < unit) unit = t.unitGross
  }
  return unit
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + lineUnit(l) * l.qty, 0)
}

function clampQty(qty: number, max: number | null): number {
  const limit = Math.min(MAX_QTY, max && max > 0 ? max : MAX_QTY)
  return Math.max(1, Math.min(limit, Math.floor(qty) || 1))
}

export function addToCart(line: Omit<CartLine, 'qty'>, qty: number) {
  const lines = readLocal<CartLine[]>(CART_KEY, EMPTY)
  const prev = lines.find((l) => l.id === line.id)
  const next = prev
    ? lines.map((l) =>
        l.id === line.id ? { ...line, qty: clampQty(l.qty + qty, line.maxQty) } : l
      )
    : [...lines, { ...line, qty: clampQty(qty, line.maxQty) }].slice(-MAX_LINES)
  writeLocal(CART_KEY, next)
}

export function setCartQty(id: string, qty: number) {
  const lines = readLocal<CartLine[]>(CART_KEY, EMPTY)
  writeLocal(
    CART_KEY,
    lines.map((l) => (l.id === id ? { ...l, qty: clampQty(qty, l.maxQty) } : l))
  )
}

export function removeFromCart(id: string) {
  const lines = readLocal<CartLine[]>(CART_KEY, EMPTY)
  writeLocal(
    CART_KEY,
    lines.filter((l) => l.id !== id)
  )
}

export function clearCart() {
  writeLocal(CART_KEY, EMPTY)
}
