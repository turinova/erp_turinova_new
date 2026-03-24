import { recomputeOrderTotalsFromItems, upsertStandardOrderTotalsRows } from '@/lib/order-totals-recompute'

type SupabaseLike = any

function roundByCurrency(value: number, currencyCode: string): number {
  const cur = String(currencyCode || 'HUF').toUpperCase()
  return cur === 'HUF' ? Math.round(value) : Math.round(value * 100) / 100
}

export async function syncOrderHeaderFeesFromOrderFees(
  supabase: SupabaseLike,
  orderId: string
): Promise<void> {
  const { data: order } = await supabase
    .from('orders')
    .select('id, currency_code')
    .eq('id', orderId)
    .single()
  if (!order) return

  const { data: fees } = await supabase
    .from('order_fees')
    .select('type, line_net, line_gross')
    .eq('order_id', orderId)
    .is('deleted_at', null)

  let shippingNet = 0
  let shippingGross = 0
  let paymentNet = 0
  let paymentGross = 0

  for (const f of fees || []) {
    const n = parseFloat(String(f.line_net)) || 0
    const g = parseFloat(String(f.line_gross)) || 0
    const type = String(f.type || 'OTHER').toUpperCase()
    if (type === 'SHIPPING') {
      shippingNet += n
      shippingGross += g
    } else if (type === 'PAYMENT') {
      paymentNet += n
      paymentGross += g
    }
  }

  shippingNet = roundByCurrency(shippingNet, order.currency_code || 'HUF')
  shippingGross = roundByCurrency(shippingGross, order.currency_code || 'HUF')
  paymentNet = roundByCurrency(paymentNet, order.currency_code || 'HUF')
  paymentGross = roundByCurrency(paymentGross, order.currency_code || 'HUF')

  await supabase
    .from('orders')
    .update({
      shipping_total_net: shippingNet,
      shipping_total_gross: shippingGross,
      shipping_net_price: shippingNet,
      shipping_gross_price: shippingGross,
      payment_total_net: paymentNet,
      payment_total_gross: paymentGross,
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)
}

export async function recomputeOrderAfterFeesChange(
  supabase: SupabaseLike,
  orderId: string
): Promise<void> {
  await syncOrderHeaderFeesFromOrderFees(supabase, orderId)
  await recomputeOrderTotalsFromItems(supabase, orderId)
  await upsertStandardOrderTotalsRows(supabase, orderId)
}

