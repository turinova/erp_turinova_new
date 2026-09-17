/** Eladás összesítő — UI előnézet, RPC-vel egyező sorrend. */

export function hungarianCashRound(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  const floor = Math.floor(amount)
  const last = floor % 10
  if (last >= 0 && last <= 2) return floor - last
  if (last >= 3 && last <= 7) return floor - last + 5
  return floor - last + 10
}

export function isCashPaymentMethodName(name: string | null | undefined): boolean {
  const n = (name ?? '').toLowerCase()
  return (
    n.includes('készpénz') ||
    n.includes('keszpenz') ||
    n === 'cash'
  )
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
