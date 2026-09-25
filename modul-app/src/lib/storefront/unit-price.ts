/**
 * Nettó tartalom + egységár (98/6/EK, 4/2009 NGM rendelet): kg, l, m, m², db.
 * Tiszta függvények — kliens és szerver.
 */

import { formatFt } from '@/lib/storefront/format'

export const NET_UNITS = ['g', 'kg', 'ml', 'l', 'db', 'm', 'm2'] as const
export type NetUnit = (typeof NET_UNITS)[number]

export const NET_UNIT_LABEL: Record<NetUnit, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'l',
  db: 'db',
  m: 'm',
  m2: 'm²'
}

/** Mértékegység → egységár alapja és szorzója (400 g → 0,4 kg). */
const BASE: Record<NetUnit, { unit: string; factor: number }> = {
  g: { unit: 'kg', factor: 1000 },
  kg: { unit: 'kg', factor: 1 },
  ml: { unit: 'l', factor: 1000 },
  l: { unit: 'l', factor: 1 },
  db: { unit: 'db', factor: 1 },
  m: { unit: 'm', factor: 1 },
  m2: { unit: 'm²', factor: 1 }
}

export type NetContent = { quantity: number; unit: NetUnit }

export function parseNetUnit(v: unknown): NetUnit | null {
  return typeof v === 'string' && (NET_UNITS as readonly string[]).includes(v)
    ? (v as NetUnit)
    : null
}

/** Nettó tartalom hiányában a több darabos kiszerelés (6 db-os csomag → 6 db) az egységár alapja. */
export function netContentOf(
  quantity: unknown,
  unit: unknown,
  multipack?: unknown
): NetContent | null {
  const q = quantity == null || quantity === '' ? NaN : Number(quantity)
  const u = parseNetUnit(unit)
  if (u && Number.isFinite(q) && q > 0) return { quantity: q, unit: u }
  const m = multipack == null ? NaN : Number(multipack)
  return Number.isInteger(m) && m >= 2 ? { quantity: m, unit: 'db' } : null
}

const huQty = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 3 })

/** „400 ml”, „3 kg”, „12 db”. */
export function netContentLabel(c: NetContent): string {
  return `${huQty.format(c.quantity)} ${NET_UNIT_LABEL[c.unit]}`
}

/** Összehasonlításhoz: mennyiség az alap-egységben (400 g → 0,4). */
export function baseQuantity(c: NetContent): number {
  return c.quantity / BASE[c.unit].factor
}

/** „3 725 Ft/l” — 1 db-os terméknél nincs értelme, ott null. */
export function unitPriceLabel(priceGross: number, c: NetContent | null): string | null {
  if (!c || !(priceGross > 0)) return null
  if (c.unit === 'db' && c.quantity === 1) return null
  const base = BASE[c.unit]
  const per = priceGross / (c.quantity / base.factor)
  if (!Number.isFinite(per) || per <= 0) return null
  return `${formatFt(per)}/${base.unit}`
}

const GOOGLE_UNIT: Record<NetUnit, { unit: string; base: string }> = {
  g: { unit: 'g', base: '1kg' },
  kg: { unit: 'kg', base: '1kg' },
  ml: { unit: 'ml', base: '1l' },
  l: { unit: 'l', base: '1l' },
  db: { unit: 'ct', base: '1ct' },
  m: { unit: 'm', base: '1m' },
  m2: { unit: 'sqm', base: '1sqm' }
}

const UN_CODE: Record<NetUnit, { code: string; base: string }> = {
  g: { code: 'GRM', base: 'KGM' },
  kg: { code: 'KGM', base: 'KGM' },
  ml: { code: 'MLT', base: 'LTR' },
  l: { code: 'LTR', base: 'LTR' },
  db: { code: 'C62', base: 'C62' },
  m: { code: 'MTR', base: 'MTR' },
  m2: { code: 'MTK', base: 'MTK' }
}

/** UN/CEFACT kód — schema.org `unitCode`. */
export function unCodeFor(c: NetContent): string {
  return UN_CODE[c.unit].code
}

/** schema.org `referenceQuantity` (Google egységár): 1 alap-egység, értéke a nettó tartalom. */
export function schemaReferenceQuantity(c: NetContent | null): Record<string, unknown> | null {
  if (!c || (c.unit === 'db' && c.quantity === 1)) return null
  const u = UN_CODE[c.unit]
  return {
    '@type': 'QuantitativeValue',
    value: 1,
    unitCode: u.base,
    valueReference: { '@type': 'QuantitativeValue', value: c.quantity, unitCode: u.code }
  }
}

/** Google Merchant `unit_pricing_measure` / `unit_pricing_base_measure`. */
export function googleUnitPricing(c: NetContent | null): { measure: string; base: string } | null {
  if (!c) return null
  const g = GOOGLE_UNIT[c.unit]
  return { measure: `${c.quantity}${g.unit}`, base: g.base }
}
