/**
 * Recompute order subtotal/tax/total from order_items and update the orders row.
 * Keeps shipping/payment totals from the order row (set before this call for manual orders).
 */
export async function recomputeOrderTotalsFromItems(supabase: any, orderId: string): Promise<void> {
  const { data: order } = await supabase
    .from('orders')
    .select('currency_code, discount_amount, shipping_total_net, shipping_total_gross, payment_total_net, payment_total_gross')
    .eq('id', orderId)
    .single()
  if (!order) return

  const { data: activeItems } = await supabase
    .from('order_items')
    .select('line_total_net, line_total_gross')
    .eq('order_id', orderId)
    .is('deleted_at', null)

  let subtotalNet = 0
  let subtotalGross = 0
  for (const row of activeItems || []) {
    subtotalNet += parseFloat(String(row.line_total_net)) || 0
    subtotalGross += parseFloat(String(row.line_total_gross)) || 0
  }
  const isHuf = (order.currency_code || 'HUF').toUpperCase() === 'HUF'
  const round = (x: number) => (isHuf ? Math.round(x) : Math.round(x * 100) / 100)
  subtotalNet = round(subtotalNet)
  subtotalGross = round(subtotalGross)

  const orderDiscount = Math.max(0, round(parseFloat(String(order.discount_amount)) || 0))
  const discountAmount = Math.min(orderDiscount, subtotalGross)
  const afterDiscountGross = round(subtotalGross - discountAmount)
  const afterDiscountNet = subtotalGross > 0
    ? round(subtotalNet - round(discountAmount * subtotalNet / subtotalGross))
    : subtotalNet
  const taxAmount = round(afterDiscountGross - afterDiscountNet)
  const shippingNet = parseFloat(String(order.shipping_total_net)) || 0
  const shippingGross = parseFloat(String(order.shipping_total_gross)) || 0
  const paymentNet = parseFloat(String(order.payment_total_net)) || 0
  const paymentGross = parseFloat(String(order.payment_total_gross)) || 0
  const totalNet = round(afterDiscountNet + shippingNet + paymentNet)
  const totalGross = round(afterDiscountGross + shippingGross + paymentGross)

  await supabase
    .from('orders')
    .update({
      subtotal_net: subtotalNet,
      subtotal_gross: subtotalGross,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total_net: totalNet,
      total_gross: totalGross,
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)
}

/** Keep order_totals rows in sync after orders row was updated (SUB_TOTAL, TAX, TOTAL). */
export async function upsertStandardOrderTotalsRows(supabase: any, orderId: string): Promise<void> {
  const { data: order } = await supabase
    .from('orders')
    .select('subtotal_net, subtotal_gross, tax_amount, total_net, total_gross')
    .eq('id', orderId)
    .single()
  if (!order) return

  const subtotalNet = parseFloat(String(order.subtotal_net)) || 0
  const subtotalGross = parseFloat(String(order.subtotal_gross)) || 0
  const taxAmount = parseFloat(String(order.tax_amount)) || 0
  const totalNet = parseFloat(String(order.total_net)) || 0
  const totalGross = parseFloat(String(order.total_gross)) || 0

  const { data: totalsRows } = await supabase
    .from('order_totals')
    .select('id, type')
    .eq('order_id', orderId)

  const byType = new Map((totalsRows || []).map((r: any) => [r.type, r.id]))
  const updateTotal = async (type: string, valueNet: number, valueGross: number) => {
    const tid = byType.get(type)
    if (tid) {
      await supabase
        .from('order_totals')
        .update({ value_net: valueNet, value_gross: valueGross })
        .eq('id', tid)
    } else {
      const name = type === 'SUB_TOTAL' ? 'Részösszeg' : type === 'TAX' ? 'ÁFA' : type === 'TOTAL' ? 'Összesen' : type
      const sortOrder = type === 'SUB_TOTAL' ? 1 : type === 'TAX' ? 2 : type === 'TOTAL' ? 10 : 5
      await supabase.from('order_totals').insert({
        order_id: orderId,
        name,
        value_net: valueNet,
        value_gross: valueGross,
        type,
        sort_order: sortOrder
      })
    }
  }

  await updateTotal('SUB_TOTAL', subtotalNet, subtotalGross)
  await updateTotal('SUB_TOTAL_WITH_TAX', subtotalNet, subtotalGross)
  await updateTotal('TAX', taxAmount, taxAmount)
  await updateTotal('TOTAL', totalNet, totalGross)
}
