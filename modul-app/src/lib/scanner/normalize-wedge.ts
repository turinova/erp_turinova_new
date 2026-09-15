import { normalizeBarcode } from '@/lib/quotes/production-utils'

/**
 * HU billentyűzet + US wedge scanner: '-'→ü, '0'→ö, 'Z'→Y a OS layout miatt.
 * Utána a közös ASCII barcode normalizálás.
 */
export function normalizeScannerBarcode(raw: string): string {
  const remapped = raw
    .split('')
    .map((ch) => {
      if (ch === 'ü') return '-'
      if (ch === 'ö') return '0'
      if (ch === 'Y') return 'Z'
      return ch
    })
    .join('')
  return normalizeBarcode(remapped)
}
