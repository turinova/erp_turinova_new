export type OrderFeeType = 'SHIPPING' | 'PAYMENT' | 'OTHER'

export type OrderFee = {
  type: OrderFeeType
  label: string
  net: number
  gross: number
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function getOrderFees(order: Record<string, unknown>): OrderFee[] {
  const shippingNet = toNumber(order.shipping_total_net)
  const shippingGross = toNumber(order.shipping_total_gross)
  const paymentNet = toNumber(order.payment_total_net)
  const paymentGross = toNumber(order.payment_total_gross)

  const fees: OrderFee[] = []

  if (shippingNet !== 0 || shippingGross !== 0) {
    fees.push({
      type: 'SHIPPING',
      label: 'Szállítási díj',
      net: shippingNet,
      gross: shippingGross
    })
  }

  if (paymentNet !== 0 || paymentGross !== 0) {
    fees.push({
      type: 'PAYMENT',
      label: 'Fizetési díj',
      net: paymentNet,
      gross: paymentGross
    })
  }

  return fees
}

