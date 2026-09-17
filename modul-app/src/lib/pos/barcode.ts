import { normalizeScannerBarcode } from '@/lib/scanner/normalize-wedge'

export { normalizeScannerBarcode }

/** Tipikus wedge barcode: rövid ASCII, kevés szóköz, nem mondat. */
export function looksLikeBarcode(raw: string): boolean {
  const t = raw.trim()
  if (t.length < 4 || t.length > 64) return false
  if (/\s{2,}/.test(t)) return false
  // Sok szóköz / hosszú szavak → inkább névkereső
  if (t.includes(' ') && t.length > 20) return false
  return /^[\x20-\x7EüöÜÖY]+$/.test(t)
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
