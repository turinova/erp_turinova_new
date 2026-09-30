import { normalizeScannerBarcode } from '@/lib/scanner/normalize-wedge'

export { normalizeScannerBarcode }

/** Tipikus wedge barcode: rövid ASCII, kevés szóköz, nem mondat. */
export function looksLikeBarcode(raw: string): boolean {
  const t = raw.trim()
  if (t.length < 4 || t.length > 64) return false
  if (/\s{2,}/.test(t)) return false
  // Sok szóköz / hosszú szavak → inkább névkereső
  if (t.includes(' ') && t.length > 20) return false
  // Pre-normalize HU wedge chars (ö/ü) + ASCII
  return /^[\x20-\x7EüöÜÖ]+$/.test(t)
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
