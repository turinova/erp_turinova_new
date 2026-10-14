import { normalizeScannerBarcode } from '@/lib/scanner/normalize-wedge'

export { normalizeScannerBarcode }

/**
 * Wedge / Enter exact-scan heurisztika — NEM typeahead debounce-hoz.
 * Szándék: `asztal`, `alma`, rövid név → false; EAN / SKU+szám → true.
 *
 * HU wedge: normalize FIRST (ö→0, ü→-) so all-zero / Digit0 scans
 * still pass `/\d/` after remap.
 */
export function looksLikeBarcode(raw: string): boolean {
  const trimmed = raw.trim()
  if (!trimmed) return false
  // Reject obvious multi-word names before normalize
  if (/\s/.test(trimmed)) return false

  const t = normalizeScannerBarcode(trimmed)
  if (t.length < 6 || t.length > 64) return false
  // Printable ASCII after remap
  if (!/^[\x21-\x7E]+$/.test(t)) return false
  // Csak betűk → soha ne legyen auto exact (név)
  if (/^[A-Za-z]+$/.test(t)) return false
  // Legalább egy számjegy (EAN / belső kód / SKU)
  return /\d/.test(t)
}

export function prepareBarcodeQuery(raw: string): {
  normalized: string
  raw: string
} {
  const trimmed = raw.trim()
  return {
    raw: trimmed,
    normalized: normalizeScannerBarcode(trimmed)
  }
}

/** Case-insensitive exact (ASCII / barcode mezők). */
export function barcodeFieldsMatch(
  stored: string | null | undefined,
  scanned: string
): boolean {
  if (!stored) return false
  return stored.toUpperCase() === scanned.toUpperCase()
}

/**
 * PostgREST `.or` filter: `ilike` wildcards nélkül = case-insensitive exact.
 * `%` `_` `,` már ki vannak szűrve a hívó oldalon.
 */
export function barcodeExactOrFilter(safe: string): string {
  return `barcode.ilike.${safe},barcode_internal.ilike.${safe},sku.ilike.${safe}`
}
