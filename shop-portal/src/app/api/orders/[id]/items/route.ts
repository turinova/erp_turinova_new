import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { reconcileOrderStockAfterLineItemsSave } from '@/lib/order-items-stock-reconcile'

/**
 * PUT /api/orders/[id]/items
 * Replace order line items: update existing, insert new, soft-delete removed.
 * Recomputes line totals and order totals (subtotal, tax, total).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, stock_reserved, subtotal_net, subtotal_gross, tax_amount, discount_amount, shipping_total_net, shipping_total_gross, payment_total_net, payment_total_gross, total_net, total_gross, currency_code')
      .eq('id', orderId)
      .is('deleted_at', null)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Rendelés nem található' },
        { status: 404 }
      )
    }

    const status = String((order as any).status || '').trim()
    const editableStatuses = new Set(['pending_review', 'new'])
    if (!editableStatuses.has(status)) {
      return NextResponse.json(
        { error: `A tételek ebben az állapotban nem szerkeszthetők (${status || 'ismeretlen'}).` },
        { status: 409 }
      )
    }

    const body = await request.json()
    const items: Array<{
      id?: string
      product_id?: string
      product_name: string
      product_sku: string
      quantity: number
      unit_price_gross: number
      tax_rate: number
      discount_amount?: number
      discount_percent?: number
    }> = Array.isArray(body.items) ? body.items : []
    const orderDiscountAmount = body.order_discount_amount != null ? parseFloat(String(body.order_discount_amount)) : null
    const orderDiscountPercent = body.order_discount_percent != null ? parseFloat(String(body.order_discount_percent)) : null
    const currencyCode = (order as any).currency_code || 'HUF'
    const isHuf = currencyCode.toUpperCase() === 'HUF'

    function roundHuf (x: number) {
      return isHuf ? Math.round(x) : Math.round(x * 100) / 100
    }

    for (const item of items) {
      if (!item.product_name || item.product_sku == null) {
        return NextResponse.json(
          { error: 'Minden tételnek kell terméknév és cikkszám' },
          { status: 400 }
        )
      }
      const qty = parseInt(String(item.quantity), 10)
      if (isNaN(qty) || qty <= 0) {
        return NextResponse.json(
          { error: 'A mennyiségnek pozitív egésznek kell lennie' },
          { status: 400 }
        )
      }
      const gross = parseFloat(String(item.unit_price_gross))
      if (isNaN(gross) || gross < 0) {
        return NextResponse.json(
          { error: 'Az egységár (bruttó) nem lehet negatív' },
          { status: 400 }
        )
      }
      const taxRate = parseFloat(String(item.tax_rate))
      if (isNaN(taxRate) || taxRate < 0) {
        return NextResponse.json(
          { error: 'Az ÁFA kulcs nem lehet negatív' },
          { status: 400 }
        )
      }
      if (!item.id && !item.product_id) {
        return NextResponse.json(
          { error: 'Új tételhez termék kiválasztása kötelező (product_id)' },
          { status: 400 }
        )
      }
      const discAmt = parseFloat(String(item.discount_amount ?? 0)) || 0
      const discPct = item.discount_percent != null ? parseFloat(String(item.discount_percent)) : null
      if (discAmt < 0 || (discPct != null && (discPct < 0 || discPct > 100))) {
        return NextResponse.json(
          { error: 'A tétel kedvezmény nem lehet negatív, és a százalék 0–100 között kell legyen' },
          { status: 400 }
        )
      }
    }

    const existingIds = new Set(items.filter((i) => i.id).map((i) => i.id))

    const { data: existingItems } = await supabase
      .from('order_items')
      .select('id')
      .eq('order_id', orderId)
      .is('deleted_at', null)

    for (const row of existingItems || []) {
      if (!existingIds.has(row.id)) {
        await supabase
          .from('order_items')
          .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', row.id)
      }
    }

    for (const it of items) {
      const quantity = parseInt(String(it.quantity), 10)
      const unitPriceGross = parseFloat(String(it.unit_price_gross))
      const taxRate = parseFloat(String(it.tax_rate))
      const lineGrossBeforeDiscount = unitPriceGross * quantity
      let itemDiscountAmount = parseFloat(String(it.discount_amount ?? 0)) || 0
      if (it.discount_percent != null) {
        const pct = parseFloat(String(it.discount_percent))
        if (!isNaN(pct)) itemDiscountAmount = roundHuf(lineGrossBeforeDiscount * pct / 100)
      }
      itemDiscountAmount = Math.max(0, Math.min(itemDiscountAmount, lineGrossBeforeDiscount))
      const lineGrossAfterDiscount = lineGrossBeforeDiscount - itemDiscountAmount
      const lineTotalGross = roundHuf(lineGrossAfterDiscount)
      const vatAmount = taxRate > 0 ? roundHuf(lineTotalGross * taxRate / (100 + taxRate)) : 0
      const lineTotalNet = lineTotalGross - vatAmount
      const unitPriceNet = quantity > 0 && taxRate > 0
        ? (unitPriceGross / (1 + taxRate / 100))
        : unitPriceGross

      if (it.id) {
        const { error: updErr } = await supabase
          .from('order_items')
          .update({
            product_id: it.product_id || null,
            product_name: it.product_name,
            product_sku: it.product_sku,
            quantity,
            unit_price_net: unitPriceNet,
            unit_price_gross: unitPriceGross,
            tax_rate: taxRate,
            discount_amount: itemDiscountAmount,
            line_total_net: lineTotalNet,
            line_total_gross: lineTotalGross,
            updated_at: new Date().toISOString()
          })
          .eq('id', it.id)
          .eq('order_id', orderId)

        if (updErr) {
          console.error('Error updating order item:', updErr)
          return NextResponse.json(
            { error: updErr.message || 'Hiba a tétel frissítésekor' },
            { status: 500 }
          )
        }
      } else {
        const { error: insErr } = await supabase
          .from('order_items')
          .insert({
            order_id: orderId,
            product_id: it.product_id || null,
            product_name: it.product_name,
            product_sku: it.product_sku,
            quantity,
            unit_price_net: unitPriceNet,
            unit_price_gross: unitPriceGross,
            tax_rate: taxRate,
            discount_amount: itemDiscountAmount,
            line_total_net: lineTotalNet,
            line_total_gross: lineTotalGross,
            status: 'pending',
            fulfillability_status: 'unknown'
          })

        if (insErr) {
          console.error('Error inserting order item:', insErr)
          return NextResponse.json(
            { error: insErr.message || 'Hiba a tétel hozzáadásakor' },
            { status: 500 }
          )
        }
      }
    }

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
    subtotalNet = roundHuf(subtotalNet)
    subtotalGross = roundHuf(subtotalGross)
    let orderDiscount = orderDiscountAmount != null
      ? Math.max(0, roundHuf(orderDiscountAmount))
      : orderDiscountPercent != null && subtotalGross > 0
        ? Math.max(0, roundHuf(subtotalGross * orderDiscountPercent / 100))
        : parseFloat(String((order as any).discount_amount)) || 0
    orderDiscount = Math.min(orderDiscount, subtotalGross)
    const afterDiscountGross = roundHuf(subtotalGross - orderDiscount)
    const afterDiscountNet = subtotalGross > 0
      ? roundHuf(subtotalNet - roundHuf(orderDiscount * subtotalNet / subtotalGross))
      : subtotalNet
    const taxAmount = roundHuf(afterDiscountGross - afterDiscountNet)
    const shippingNet = parseFloat(String(order.shipping_total_net)) || 0
    const shippingGross = parseFloat(String(order.shipping_total_gross)) || 0
    const paymentNet = parseFloat(String(order.payment_total_net)) || 0
    const paymentGross = parseFloat(String(order.payment_total_gross)) || 0
    const totalNet = roundHuf(afterDiscountNet + shippingNet + paymentNet)
    const totalGross = roundHuf(afterDiscountGross + shippingGross + paymentGross)

    await supabase
      .from('orders')
      .update({
        subtotal_net: subtotalNet,
        subtotal_gross: subtotalGross,
        discount_amount: orderDiscount,
        tax_amount: taxAmount,
        total_net: totalNet,
        total_gross: totalGross,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)

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

    const reconcileResult = await reconcileOrderStockAfterLineItemsSave(supabase, orderId, {
      createdBy: user.id
    })
    if (!reconcileResult.ok) {
      console.error('Order items save: stock reconcile failed', reconcileResult.error)
      return NextResponse.json(
        { error: reconcileResult.error || 'A tételek mentve, de a készletfoglalás frissítése sikertelen.' },
        { status: 500 }
      )
    }

    const { data: updatedItems } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      items: updatedItems || [],
      subtotal_net: subtotalNet,
      subtotal_gross: subtotalGross,
      discount_amount: orderDiscount,
      tax_amount: taxAmount,
      total_net: totalNet,
      total_gross: totalGross,
      fulfillability_status: reconcileResult.fulfillability_status,
      stock_reserved: reconcileResult.stock_reserved
    })
  } catch (error) {
    console.error('Error in orders items PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
