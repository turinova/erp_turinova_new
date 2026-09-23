/** Eladás összesítő — UI előnézet, RPC-vel egyező sorrend. */

export { isCashPaymentMethodName } from '@/lib/sales/payment-kind'

export function hungarianCashRound(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  const floor = Math.floor(amount)
  const last = floor % 10
  if (last >= 0 && last <= 2) return floor - last
  if (last >= 3 && last <= 7) return floor - last + 5
  return floor - last + 10
}

export function netVatFromGross(
  gross: number,
  taxPercent: number
): { net: number; vat: number } {
  const g = Math.round(gross)
  if (g <= 0) return { net: 0, vat: 0 }
  if (!(taxPercent > 0)) return { net: g, vat: 0 }
  const net = Math.round(g / (1 + taxPercent / 100))
  return { net, vat: g - net }
}

export type SaleTotalsLineInput = {
  quantity: number
  unitPriceGross: number
  discountPercentage?: number
  taxPercent: number
}

export type SaleTotalsFeeInput = {
  unitPriceGross: number
  taxPercent: number
}

export type SaleTotalsResult = {
  itemsGross: number
  feesGross: number
  subtotalGross: number
  globalDiscountAmount: number
  globalDiscountPercent: number
  /** Kedvezmény előtti nettó (tételek+díjak) */
  subtotalNet: number
  /** Kedvezmény előtti ÁFA */
  subtotalVat: number
  /** Kedvezmény utáni bruttó (kerekítés előtt) */
  totalGross: number
  /** Kedvezmény utáni nettó */
  totalNet: number
  /** Kedvezmény utáni ÁFA */
  totalVat: number
  cashRoundingAmount: number
  /** Fizetendő (cash round után, ha alkalmazva) */
  due: number
}

function lineGrossAfterDiscount(line: SaleTotalsLineInput): number {
  const before = Math.round(line.quantity * line.unitPriceGross)
  const disc = Math.round((before * (line.discountPercentage || 0)) / 100)
  return Math.max(0, before - disc)
}

export function computeSaleTotals(input: {
  lines: SaleTotalsLineInput[]
  fees: SaleTotalsFeeInput[]
  globalDiscountPercent?: number
  /** Egyetlen készpénzes fizetés → magyar kerekítés */
  applyCashRound?: boolean
}): SaleTotalsResult {
  let itemsGross = 0
  let itemsNet = 0
  let itemsVat = 0
  for (const line of input.lines) {
    const g = lineGrossAfterDiscount(line)
    itemsGross += g
    const split = netVatFromGross(g, line.taxPercent)
    itemsNet += split.net
    itemsVat += split.vat
  }

  let feesGross = 0
  let feesNet = 0
  let feesVat = 0
  for (const fee of input.fees) {
    const g = Math.round(fee.unitPriceGross)
    feesGross += g
    const split = netVatFromGross(g, fee.taxPercent)
    feesNet += split.net
    feesVat += split.vat
  }

  const subtotalGross = itemsGross + feesGross
  const subtotalNet = itemsNet + feesNet
  const subtotalVat = itemsVat + feesVat

  const globalDiscountPercent = Math.min(
    100,
    Math.max(0, input.globalDiscountPercent || 0)
  )
  const globalDiscountAmount = Math.round(
    (subtotalGross * globalDiscountPercent) / 100
  )
  const totalGross = Math.max(0, subtotalGross - globalDiscountAmount)

  let totalNet = 0
  let totalVat = 0
  if (subtotalGross > 0 && totalGross > 0) {
    totalVat = Math.round(subtotalVat * (totalGross / subtotalGross))
    totalNet = totalGross - totalVat
  }

  let cashRoundingAmount = 0
  let due = totalGross
  if (input.applyCashRound && totalGross > 0) {
    due = hungarianCashRound(totalGross)
    cashRoundingAmount = due - totalGross
  }

  return {
    itemsGross,
    feesGross,
    subtotalGross,
    globalDiscountAmount,
    globalDiscountPercent,
    subtotalNet,
    subtotalVat,
    totalGross,
    totalNet,
    totalVat,
    cashRoundingAmount,
    due
  }
}

/** Visszáru előnézet — RPC pro-rata logikával egyező. */
export type ReturnableLine = {
  id: string
  itemKind: 'product' | 'fee'
  name: string
  quantitySold: number
  quantityReturned: number
  totalGross: number
  taxPercent: number
}

export type ReturnPreviewLineInput = {
  itemId: string
  quantity: number
}

export type ReturnPreviewResult = {
  subtotalGross: number
  totalNet: number
  totalVat: number
  cashRoundingAmount: number
  refundDue: number
  lines: {
    itemId: string
    quantity: number
    totalGross: number
    totalNet: number
    totalVat: number
  }[]
}

export function computeReturnPreview(input: {
  saleTotalGross: number
  saleCashRounding: number
  itemsSumGross: number
  returnable: ReturnableLine[]
  selected: ReturnPreviewLineInput[]
  /** Még nem volt visszáru + minden maradék megy vissza */
  isFullFirstReturn: boolean
  alreadyRefunded: number
  paidSum: number
  applyCashRound?: boolean
}): ReturnPreviewResult {
  const factor =
    input.itemsSumGross > 0 ? input.saleTotalGross / input.itemsSumGross : 0

  const byId = new Map(input.returnable.map((r) => [r.id, r]))
  const lines: ReturnPreviewResult['lines'] = []
  let subtotalGross = 0
  let totalNet = 0
  let totalVat = 0

  for (const sel of input.selected) {
    const src = byId.get(sel.itemId)
    if (!src || sel.quantity <= 0) continue
    const returnableQty = Math.max(0, src.quantitySold - src.quantityReturned)
    const qty = Math.min(sel.quantity, returnableQty)
    if (qty <= 0) continue

    const lineEffective = Math.round(src.totalGross * factor)
    // Already returned value approximated by qty share of full effective
    const alreadyShare =
      src.quantitySold > 0
        ? Math.round(lineEffective * (src.quantityReturned / src.quantitySold))
        : 0
    const remainingValue = Math.max(0, lineEffective - alreadyShare)

    let lineGross: number
    if (qty >= returnableQty - 0.0001) {
      lineGross = remainingValue
    } else if (returnableQty <= 0) {
      lineGross = 0
    } else {
      lineGross = Math.round(remainingValue * (qty / returnableQty))
    }

    const split = netVatFromGross(lineGross, src.taxPercent)
    lines.push({
      itemId: sel.itemId,
      quantity: qty,
      totalGross: lineGross,
      totalNet: split.net,
      totalVat: split.vat
    })
    subtotalGross += lineGross
    totalNet += split.net
    totalVat += split.vat
  }

  let refundDue = subtotalGross
  let cashRoundingAmount = 0

  if (input.isFullFirstReturn) {
    refundDue = input.saleTotalGross + (input.saleCashRounding || 0)
    cashRoundingAmount = input.saleCashRounding || 0
  }

  const netPaid = Math.max(0, input.paidSum - input.alreadyRefunded)
  if (refundDue > netPaid) refundDue = netPaid

  if (input.applyCashRound && !input.isFullFirstReturn && refundDue > 0) {
    const rounded = hungarianCashRound(refundDue)
    cashRoundingAmount = rounded - refundDue
    refundDue = rounded
    if (refundDue > netPaid) {
      refundDue = netPaid
      cashRoundingAmount = 0
    }
  }

  return {
    subtotalGross,
    totalNet,
    totalVat,
    cashRoundingAmount,
    refundDue,
    lines
  }
}
