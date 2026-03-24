export type FeeBreakdownRow = {
  type: string
  name: string
  net: number
  gross: number
}

export type FeeBreakdown = {
  shippingNet: number
  shippingGross: number
  paymentNet: number
  paymentGross: number
  otherNet: number
  otherGross: number
  rows: FeeBreakdownRow[]
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function buildOrderFeeBreakdown(fees: Array<Record<string, unknown>>): FeeBreakdown {
  let shippingNet = 0
  let shippingGross = 0
  let paymentNet = 0
  let paymentGross = 0
  let otherNet = 0
  let otherGross = 0

  const rows: FeeBreakdownRow[] = []

  for (const fee of fees || []) {
    const type = String(fee.type || 'OTHER').toUpperCase()
    const net = toNumber(fee.line_net ?? fee.net)
    const gross = toNumber(fee.line_gross ?? fee.gross)
    const name = String(fee.name || fee.label || 'Díj')

    rows.push({ type, name, net, gross })

    if (type === 'SHIPPING') {
      shippingNet += net
      shippingGross += gross
    } else if (type === 'PAYMENT') {
      paymentNet += net
      paymentGross += gross
    } else {
      otherNet += net
      otherGross += gross
    }
  }

  return {
    shippingNet,
    shippingGross,
    paymentNet,
    paymentGross,
    otherNet,
    otherGross,
    rows
  }
}

