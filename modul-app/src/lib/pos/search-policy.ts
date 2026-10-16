/**
 * POS keresési döntési fa — egy mező, chip = szűrő.
 * Bolti clerk: Mind mindig keres terméket ≥4 digiten; 3 digit stub = tábla-only.
 *
 * Iparági minták: Odoo exact-suppress (len>5), ERPNext barcode-first,
 * StoreConnect egy mező name/SKU/barcode.
 */

import { isSkuTypeaheadQuery, looksLikeBarcode } from '@/lib/pos/barcode'
import { isSheetMachineCodeQuery } from '@/lib/sales/material-qty'

export type PosSearchKind =
  | 'all'
  | 'product'
  | 'sheet_material'
  | 'linear_material'

/** Pontosan 3 jegyű tábla-gépkód stub (312) — Mindnél termék zaj nélkül. */
export function isSheetDigitStub(q: string): boolean {
  const t = q.trim()
  return /^\d{3}$/.test(t)
}

/**
 * Mind + sheetCode heurisztika: csak a 3 jegyű stubnál tiltsuk a terméket.
 * ≥4 digit (SKU / hosszú gépkód) → termék + anyag együtt.
 */
export function wantProductInSaleSearch(opts: {
  kind: PosSearchKind
  q: string
  includeMaterials: boolean
}): boolean {
  const { kind, q, includeMaterials } = opts
  if (kind !== 'all' && kind !== 'product') return false
  const sheetCodeQ = isSheetMachineCodeQuery(q)
  const sheetOnlyStub =
    sheetCodeQ &&
    includeMaterials &&
    kind === 'all' &&
    isSheetDigitStub(q)
  return !sheetOnlyStub
}

/** Want sheet materials in sale search (chip + lapszab). */
export function wantSheetInSaleSearch(opts: {
  kind: PosSearchKind
  q: string
  includeMaterials: boolean
}): boolean {
  const { kind, includeMaterials } = opts
  if (!includeMaterials) return false
  if (kind !== 'all' && kind !== 'sheet_material') return false
  return true
}

/**
 * Enter / scan: product exact lookup?
 * Ne blokkoljuk numerikus SKU-t (4–12) a sheet-code heurisztikával —
 * csak 3 jegyű stubnál lista-pick (anyag).
 */
export function shouldRunBarcodeEnter(opts: {
  q: string
  hasLapszabaszat: boolean
  searchKind: PosSearchKind
}): boolean {
  const q = opts.q.trim()
  if (!q) return false
  const sheetStubEnter =
    opts.hasLapszabaszat &&
    isSheetDigitStub(q) &&
    opts.searchKind !== 'product' &&
    opts.searchKind !== 'linear_material'
  if (sheetStubEnter) return false
  return looksLikeBarcode(q) || isSkuTypeaheadQuery(q)
}

/**
 * Odoo-style: hosszú exact találat → ne keverj fuzzy zajt.
 * Rövid SKU (4–5): fuzzy/prefix marad a listában.
 */
export function shouldExactSuppressFuzzy(q: string, hasExactHit: boolean): boolean {
  if (!hasExactHit) return false
  return q.trim().length > 5
}

/**
 * Typeahead útvonal: barcode-only exact preview (EAN / CODE128),
 * ne fuzzy — kivéve SKU 4–12 digit.
 */
export function isBarcodeExactPreviewOnly(q: string, sheetCodeActive: boolean): boolean {
  if (sheetCodeActive) return false
  return looksLikeBarcode(q) && !isSkuTypeaheadQuery(q)
}

/**
 * Részleges alfanum barcode gépelés közben: ne „nincs találat” panik.
 * Miss dialóg csak Enter/scan után.
 */
export function shouldShowTypingMissEmpty(opts: {
  q: string
  exactMiss: boolean
  sheetCodeActive: boolean
}): boolean {
  if (!opts.exactMiss) return false
  // Exact-preview path miss while typing incomplete CODE128
  if (isBarcodeExactPreviewOnly(opts.q, opts.sheetCodeActive)) {
    return false
  }
  return true
}

/** Min. gépelési hossz typeaheadhez. */
export function searchMinLength(opts: {
  q: string
  sheetCodeActive: boolean
}): number {
  if (opts.sheetCodeActive) return 3
  if (/^\d+$/.test(opts.q.trim())) return 4
  return 2
}

/** Merge exact + fuzzy rows (exact first; optional suppress). */
export function mergeExactAndFuzzyHits<T extends { id: string }>(
  q: string,
  fuzzyRows: T[],
  exact: T | null
): T[] {
  if (!exact) return fuzzyRows
  if (shouldExactSuppressFuzzy(q, true)) return [exact]
  const rest = fuzzyRows.filter((r) => r.id !== exact.id)
  return [exact, ...rest]
}
