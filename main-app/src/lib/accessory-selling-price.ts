/**
 * Canonical accessory *selling* gross (HUF integers) for list/POS/shipment/PDA.
 *
 * Rules:
 * - Prefer DB `gross_price` when present (NULL/undefined in DB → fallback only).
 * - Fallback matches SQL migration pattern: ROUND(net + net * VAT% / 100).
 * - Display VAT amount is aligned to resolved gross so net + ÁFA ≈ bruttó on screen.
 *
 * Note: Hungarian *cash* payable rounding (0/5) applies at order/payment level, not here.
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

/**
 * Fallback gross when `gross_price` column is NULL (same as populate migration).
 */
export function fallbackAccessoryGrossFromNet(netPrice: number, vatKulcs: number): number {
  const net = safeInt(netPrice)
  const vat = Number(vatKulcs) || 0
  if (net <= 0) return 0
  return Math.round(net + (net * vat) / 100)
}

/**
 * Resolved selling gross for API responses.
 */
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

/**
 * ÁFA összeg úgy, hogy nettó + ÁFA = bruttó egész Ft-ban (lista/POS konzisztencia).
 */
export function accessoryVatAmountAligned(netPrice: number | null | undefined, resolvedGross: number): number {
  const net = safeInt(netPrice)
  const gross = Math.max(0, safeInt(resolvedGross))
  return Math.max(0, gross - net)
}

/** Supabase may return joined `vat` as object or single-element array. */
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
