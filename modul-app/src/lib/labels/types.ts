export const PRODUCT_LABELS_FEATURE = 'product_labels' as const

export type LabelSize = '33x25'

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

export function labelBarcodeValue(
  payload: Pick<ProductLabelPayload, 'barcode' | 'barcodeInternal'>
): string | null {
  const a = payload.barcode?.trim()
  if (a) return a
  const b = payload.barcodeInternal?.trim()
  return b || null
}

export function labelSizeMm(_size?: LabelSize): { w: number; h: number } {
  void _size
  return { w: 33, h: 25 }
}
