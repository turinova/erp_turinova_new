import { isValidEan13 } from '@/lib/barcodes/ean13'
import {
  barcodeCompactAlnum,
  normalizeScannerBarcode,
  swapBarcodeYZ
} from '@/lib/scanner/normalize-wedge'

export { normalizeScannerBarcode, barcodeCompactAlnum, swapBarcodeYZ }

/**
 * UPC-A (12 digit) → EAN-13 leading-0 pad, csak ha az eredmény érvényes EAN-13.
 * Sok scanner a 0-val kezdődő EAN-13-at 12 jegyként küldi.
 */
export function upcAToEan13Candidate(code: string): string | null {
  const d = code.replace(/\D/g, '')
  if (d.length !== 12) return null
  const padded = `0${d}`
  return isValidEan13(padded) ? padded : null
}

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

/**
 * Tiszta szám SKU (4–12 jegy) — typeahead OK.
 * EAN-13 (13 jegy) és alfanumerikus CODE128 → exact-first, ne fuzzy lista.
 */
export function isSkuTypeaheadQuery(raw: string): boolean {
  const t = raw.trim()
  if (!/^\d+$/.test(t)) return false
  return t.length >= 4 && t.length <= 12
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

/**
 * Exact lookup próbák: normalize, nyers, Y↔Z (HU QWERTZ), hyphen-compact,
 * UPC-A→EAN-13 (12 digit + érvényes vezető 0).
 * Max ~8 dedupe-olt UPPER string — 1 RPC / kandidátus, indexbarát.
 */
export function barcodeLookupCandidates(code: string): string[] {
  const { raw, normalized } = prepareBarcodeQuery(code)
  const bases = [normalized, raw]
    .filter(Boolean)
    .map((c) => c.replace(/[%_,]/g, '').trim())
    .filter(Boolean)
    .map((c) => c.toUpperCase())

  const out = new Set<string>()
  for (const b of bases) {
    out.add(b)
    const yz = swapBarcodeYZ(b)
    if (yz !== b) out.add(yz)
    const compact = barcodeCompactAlnum(b)
    if (compact && compact !== b) out.add(compact)
    if (yz !== b) {
      const yzCompact = barcodeCompactAlnum(yz)
      if (yzCompact) out.add(yzCompact)
    }
    const ean13 = upcAToEan13Candidate(b)
    if (ean13) out.add(ean13)
    if (compact) {
      const eanFromCompact = upcAToEan13Candidate(compact)
      if (eanFromCompact) out.add(eanFromCompact)
    }
  }
  return [...out]
}

/** Case-insensitive exact (ASCII / barcode mezők) — JS safety a hit-listán. */
export function barcodeFieldsMatch(
  stored: string | null | undefined,
  scanned: string
): boolean {
  if (!stored) return false
  const a = stored.toUpperCase()
  const b = scanned.toUpperCase()
  if (a === b) return true
  const ca = barcodeCompactAlnum(a)
  const cb = barcodeCompactAlnum(b)
  if (ca && ca === cb) return true
  if (ca && ca === barcodeCompactAlnum(swapBarcodeYZ(b))) return true
  if (cb && barcodeCompactAlnum(swapBarcodeYZ(a)) === cb) return true
  // UPC-A (12) ↔ EAN-13 (0 + 12) — mindkét irány
  const padB = upcAToEan13Candidate(b)
  if (padB && (a === padB || ca === padB)) return true
  const padA = upcAToEan13Candidate(a)
  if (padA && (b === padA || cb === padA)) return true
  return false
}

/**
 * Mentéskor: HU wedge remap (ö→0, ü→-) + trim + ASCII UPPER
 * (ugyanaz a path, mint a szkenner / gyártás vonalkód mező).
 * Üres → null — btree `.eq.` index barát.
 */
export function normalizeStoredBarcode(
  raw: string | null | undefined
): string | null {
  if (raw == null) return null
  const t = normalizeScannerBarcode(raw)
  return t || null
}

/**
 * PostgREST `.or` exact filter — btree unique index barát (ne ilike).
 * Case: hívó oldalon UPPER `normalizeScannerBarcode` / `normalizeStoredBarcode`.
 * `%` `_` `,` már ki vannak szűrve a hívó oldalon.
 */
export function barcodeExactOrFilter(safe: string): string {
  return `barcode.eq.${safe},barcode_internal.eq.${safe},sku.eq.${safe}`
}
