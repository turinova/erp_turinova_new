import { grossFromNet, netFromGross } from '@/lib/accessories/parse'
import type { WebPriceTier } from '@/lib/accessories/web-shop'
import type { AttributeInput } from '@/lib/webshop/types'

import type { ShopXAttribute } from '@/lib/webshop/excel/context'

export function formatNumberHu(n: number): string {
  return String(Math.round(n * 1000) / 1000).replace('.', ',')
}

/** „2,5” / „2.5” / „1 800” → szám; üres vagy hibás → null / NaN. */
export function parseNumberHu(raw: string): number | null {
  const t = raw.trim().replace(/\s|\u00a0/g, '')
  if (!t) return null
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) ? n : Number.NaN
}

export function splitList(raw: string): string[] {
  return raw
    .split(/\r?\n|\|/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function joinList(items: string[]): string {
  return items.join(' | ')
}

export const BOOL_TRUE = ['igen', 'i', 'yes', 'y', 'x', 'true', '1', 'van']
export const BOOL_FALSE = ['nem', 'n', 'no', 'false', '0', 'nincs']

export function parseBool(raw: string): boolean | null {
  const v = raw.trim().toLowerCase()
  if (BOOL_TRUE.includes(v)) return true
  if (BOOL_FALSE.includes(v)) return false
  return null
}

export function formatBool(v: boolean): string {
  return v ? 'igen' : 'nem'
}

/** Nettó tier → „10 db: 1800; 50 db: 1650” (bruttó). */
export function formatTiersGross(tiers: WebPriceTier[], vatPercent: number): string {
  return tiers.map((t) => `${t.min_qty} db: ${grossFromNet(t.price_net, vatPercent)}`).join('; ')
}

export type TierParse = { ok: true; tiers: WebPriceTier[] } | { ok: false; message: string }

export function parseTiersGross(raw: string, vatPercent: number, basePriceGross: number): TierParse {
  const parts = raw
    .split(/;|\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  const seen = new Set<number>()
  const tiers: WebPriceTier[] = []
  for (const part of parts) {
    const m = part.match(/^(\d[\d\s]*)\s*(?:db|pcs)?\s*[:=]\s*([\d\s.,]+)\s*(?:ft)?$/i)
    if (!m) {
      return { ok: false, message: `Nem értjük: „${part}”. Így írd: 10 db: 1800; 50 db: 1650` }
    }
    const qty = Number(m[1].replace(/\s/g, ''))
    const gross = parseNumberHu(m[2])
    if (!Number.isInteger(qty) || qty < 2) {
      return { ok: false, message: 'Mennyiségi ár legalább 2 db-tól adható meg.' }
    }
    if (gross == null || Number.isNaN(gross) || gross <= 0) {
      return { ok: false, message: `Hibás ár: „${part}”.` }
    }
    if (seen.has(qty)) return { ok: false, message: `A ${qty} db kétszer szerepel.` }
    if (basePriceGross > 0 && gross >= basePriceGross) {
      return {
        ok: false,
        message: `A ${qty} db-os ár (${Math.round(gross)} Ft) nem olcsóbb az alapárnál (${basePriceGross} Ft).`
      }
    }
    seen.add(qty)
    tiers.push({ min_qty: qty, price_net: netFromGross(Math.round(gross), vatPercent) })
  }
  if (tiers.length > 10) return { ok: false, message: 'Legfeljebb 10 mennyiségi ár adható meg.' }
  return { ok: true, tiers: tiers.sort((a, b) => a.min_qty - b.min_qty) }
}

/** Egy termék egy jellemzőjének szöveges értéke (export + változat választó). */
export function attributeDisplay(
  attr: ShopXAttribute,
  valueIds: Set<string>,
  inputs: AttributeInput[]
): string | null {
  if (attr.valueType === 'list') {
    const labels = attr.values.filter((v) => valueIds.has(v.id)).map((v) => v.label)
    return labels.length > 0 ? joinList(labels) : null
  }
  const input = inputs.find((i) => i.attributeId === attr.id)
  if (!input) return null
  if (attr.valueType === 'boolean') {
    return input.valueBool == null ? null : formatBool(input.valueBool)
  }
  if (input.valueNum == null && input.valueMax == null) return null
  if (attr.valueType === 'range' && input.valueMax != null) {
    return `${input.valueNum != null ? formatNumberHu(input.valueNum) : ''}-${formatNumberHu(input.valueMax)}`
  }
  return input.valueNum != null ? formatNumberHu(input.valueNum) : null
}

/** Levenshtein-távolság kis szövegekre (javaslatokhoz). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

/** A legközelebbi jelölt, ha elég közel van ahhoz, hogy elírásnak tűnjön. */
export function closest<T>(needle: string, items: T[], keyOf: (t: T) => string): T | null {
  let best: T | null = null
  let bestD = Number.POSITIVE_INFINITY
  for (const item of items) {
    const d = editDistance(needle, keyOf(item))
    if (d < bestD) {
      bestD = d
      best = item
    }
  }
  const limit = Math.max(2, Math.floor(needle.length * 0.3))
  return best && bestD <= limit ? best : null
}
