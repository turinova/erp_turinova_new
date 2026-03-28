/**
 * Same logic as main-app/src/lib/accessory-selling-price.ts (keep in sync).
 * Canonical accessory selling gross for PDA check / barcode flows.
 */

export type AccessoryVatLike = { kulcs?: number | null } | null | undefined

function safeInt(n: unknown): number {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x)
}

export function vatKulcsFromRow(vat: AccessoryVatLike): number {
  if (!vat || typeof vat !== 'object') return 0
  return safeInt(vat.kulcs)
}

export function fallbackAccessoryGrossFromNet(netPrice: number, vatKulcs: number): number {
  const net = safeInt(netPrice)
  const vat = Number(vatKulcs) || 0
  if (net <= 0) return 0
  return Math.round(net + (net * vat) / 100)
}

export function resolveAccessorySellingGross(params: {
  netPrice: number | null | undefined
  grossPriceFromDb: number | null | undefined
  vatKulcs: number
}): number {
  const { grossPriceFromDb, vatKulcs } = params
  const net = safeInt(params.netPrice)

  if (grossPriceFromDb !== null && grossPriceFromDb !== undefined && Number.isFinite(Number(grossPriceFromDb))) {
    return Math.max(0, safeInt(grossPriceFromDb))
  }

  return fallbackAccessoryGrossFromNet(net, vatKulcs)
}

export function accessoryVatAmountAligned(netPrice: number | null | undefined, resolvedGross: number): number {
  const net = safeInt(netPrice)
  const gross = Math.max(0, safeInt(resolvedGross))
  return Math.max(0, gross - net)
}

export function accessoryVatFieldFromJoin(vat: unknown): AccessoryVatLike {
  if (vat == null) return null
  if (Array.isArray(vat)) {
    const first = vat[0]
    if (first && typeof first === 'object') return first as AccessoryVatLike
    return null
  }
  if (typeof vat === 'object') return vat as AccessoryVatLike
  return null
}

export function resolveAccessorySellingGrossFromRow(row: {
  net_price?: number | null
  gross_price?: number | null
  vat?: unknown
}): { gross_price: number; vat_amount: number } {
  const vatObj = accessoryVatFieldFromJoin(row.vat)
  const vatKulcs = vatKulcsFromRow(vatObj)
  const gross_price = resolveAccessorySellingGross({
    netPrice: row.net_price,
    grossPriceFromDb: row.gross_price,
    vatKulcs,
  })
  const vat_amount = accessoryVatAmountAligned(row.net_price, gross_price)
  return { gross_price, vat_amount }
}
