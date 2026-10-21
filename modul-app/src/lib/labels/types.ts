import { isValidEan13 } from '@/lib/barcodes/ean13'

export const PRODUCT_LABELS_FEATURE = 'product_labels' as const

export type LabelSize = '33x25'

/** Which code to print on the label. */
export type LabelBarcodeSource = 'auto' | 'supplier' | 'internal'

export type LabelFields = {
  showName: boolean
  showSku: boolean
  showBarcode: boolean
  showPrice: boolean
}

export type ProductLabelPayload = {
  id: string
  name: string
  sku: string
  barcode: string | null
  barcodeInternal: string | null
  priceGross: number
  unitShortform: string
}

/**
 * Resolve printable barcode.
 * `auto`: prefer valid internal EAN-13 (thicker X on 33×25), else supplier, else internal.
 */
export function labelBarcodeValue(
  payload: Pick<ProductLabelPayload, 'barcode' | 'barcodeInternal'>,
  source: LabelBarcodeSource = 'auto'
): string | null {
  const supplier = payload.barcode?.trim() || ''
  const internal = payload.barcodeInternal?.trim() || ''
  if (source === 'supplier') return supplier || null
  if (source === 'internal') return internal || null
  if (internal && isValidEan13(internal)) return internal
  if (supplier) return supplier
  return internal || null
}

export function labelSizeMm(_size?: LabelSize): { w: number; h: number } {
  void _size
  return { w: 33, h: 25 }
}
