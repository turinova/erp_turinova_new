import { normalizeScannerBarcode } from '@/lib/scanner/normalize-wedge'

export { normalizeScannerBarcode }

/**
 * Wedge / Enter exact-scan heurisztika — NEM typeahead debounce-hoz.
 * Szándék: `asztal`, `alma`, rövid név → false; EAN / SKU+szám → true.
 */
export function looksLikeBarcode(raw: string): boolean {
  const t = raw.trim()
  if (t.length < 6 || t.length > 64) return false
  // Szóköz → név / mondat kereső
  if (/\s/.test(t)) return false
  // Pre-normalize HU wedge chars (ö/ü) + ASCII
  if (!/^[\x21-\x7EüöÜÖ]+$/.test(t)) return false
  // Csak betűk (ékezetes név) → soha ne legyen auto exact
  if (/^[A-Za-züöÜÖáéíóúőűÁÉÍÓÚŐŰ]+$/u.test(t)) return false
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
