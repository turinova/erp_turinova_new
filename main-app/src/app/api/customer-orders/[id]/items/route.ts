import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// POST /api/customer-orders/[id]/items - add a new product item immediately
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Basic validations
    if (!body?.product_type) {
      return NextResponse.json({ error: 'product_type kötelező' }, { status: 400 })
    }

    const fkCount = [body.accessory_id, body.material_id, body.linear_material_id].filter(Boolean).length
    if (fkCount !== 1) {
      return NextResponse.json({ error: 'Pontosan 1 termék azonosító szükséges (accessory/material/linear_material).' }, { status: 400 })
    }

    if (!body.product_name || !body.quantity || !body.unit_price_gross || !body.vat_id || !body.currency_id) {
      return NextResponse.json({ error: 'Hiányzó kötelező mezők (name, quantity, ár, ÁFA, pénznem).' }, { status: 400 })
    }

    // Check order status
    const { data: order } = await supabaseServer
      .from('customer_orders')
      .select('status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (!order) {
      return NextResponse.json({ error: 'Rendelés nem található' }, { status: 404 })
    }

    if (order.status !== 'open') {
      return NextResponse.json({ error: 'Csak nyitott rendeléshez adható tétel.' }, { status: 400 })
    }

    // Fetch VAT rate to recompute net/totals safely
    const { data: vatRow } = await supabaseServer
      .from('vat')
      .select('kulcs')
      .eq('id', body.vat_id)
      .single()

    const vatPercent = vatRow?.kulcs || 0
    const vatMultiplier = 1 + vatPercent / 100
    const quantity = Number(body.quantity) || 1
    const unitPriceGross = Math.round(Number(body.unit_price_gross) || 0)
    const unitPriceNet = Math.round(unitPriceGross / vatMultiplier)
    const totalGross = Math.round(unitPriceGross * quantity)
    const totalNet = Math.round(unitPriceNet * quantity)
    const totalVat = totalGross - totalNet

    const insertPayload = {
      order_id: id,
      item_type: 'product' as const,
      status: 'open',
      product_type: body.product_type,
      accessory_id: body.accessory_id || null,
      material_id: body.material_id || null,
      linear_material_id: body.linear_material_id || null,
      feetype_id: null,
      product_name: body.product_name,
      sku: body.sku || null,
      quantity,
      unit_price_net: unitPriceNet,
      unit_price_gross: unitPriceGross,
      vat_id: body.vat_id,
      currency_id: body.currency_id,
      units_id: body.units_id || null,
      total_net: totalNet,
      total_vat: totalVat,
      total_gross: totalGross,
      partner_id: body.partner_id || null,
      shop_order_item_id: null,
      purchase_order_item_id: null
    }

    const { data: inserted, error: insertError } = await supabaseServer
      .from('customer_order_items')
      .insert(insertPayload)
      .select(`
        id,
        item_type,
        product_type,
        accessory_id,
        material_id,
        linear_material_id,
        feetype_id,
        product_name,
        sku,
        quantity,
        unit_price_net,
        unit_price_gross,
        vat_id,
        currency_id,
        units_id,
        total_net,
        total_vat,
        total_gross,
        status,
        purchase_order_item_id
      `)
      .single()

    if (insertError || !inserted) {
      console.error('Error inserting customer_order_item:', insertError)
      return NextResponse.json({ error: 'Hiba a tétel hozzáadásakor' }, { status: 500 })
    }

    // Recalculate customer_order totals
    const { data: allItems } = await supabaseServer
      .from('customer_order_items')
      .select('total_net, total_vat, total_gross, item_type')
      .eq('order_id', id)
      .is('deleted_at', null)

    if (allItems) {
      const products = allItems.filter(item => item.item_type === 'product')
      const fees = allItems.filter(item => item.item_type === 'fee')
      
      const itemsNet = products.reduce((sum, item) => sum + Number(item.total_net || 0), 0)
      const itemsVat = products.reduce((sum, item) => sum + Number(item.total_vat || 0), 0)
      const itemsGross = products.reduce((sum, item) => sum + Number(item.total_gross || 0), 0)
      
      const feesNet = fees.reduce((sum, item) => sum + Number(item.total_net || 0), 0)
      const feesVat = fees.reduce((sum, item) => sum + Number(item.total_vat || 0), 0)
      const feesGross = fees.reduce((sum, item) => sum + Number(item.total_gross || 0), 0)
      
      const totalNetBeforeDiscount = itemsNet + feesNet
      const totalVatBeforeDiscount = itemsVat + feesVat
      const totalGrossBeforeDiscount = itemsGross + feesGross
      
      // Get discount from order
      const { data: orderData } = await supabaseServer
        .from('customer_orders')
        .select('discount_amount')
        .eq('id', id)
        .single()
      
      const discountAmount = Number(orderData?.discount_amount || 0)
      const totalGrossAfterDiscount = totalGrossBeforeDiscount - discountAmount
      
      // Calculate net and VAT after discount proportionally
      const discountRatio = totalGrossBeforeDiscount > 0 ? discountAmount / totalGrossBeforeDiscount : 0
      const totalNetAfterDiscount = totalNetBeforeDiscount * (1 - discountRatio)
      const totalVatAfterDiscount = totalVatBeforeDiscount * (1 - discountRatio)
      
      // Update customer_order totals
      await supabaseServer
        .from('customer_orders')
        .update({
          subtotal_net: Math.round(totalNetAfterDiscount),
          total_vat: Math.round(totalVatAfterDiscount),
          total_gross: Math.round(totalGrossAfterDiscount),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
    }

    return NextResponse.json({ item: inserted })
  } catch (error) {
    console.error('Error in POST /api/customer-orders/[id]/items:', error)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}

