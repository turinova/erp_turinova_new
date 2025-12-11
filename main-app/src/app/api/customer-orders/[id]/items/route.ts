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

    return NextResponse.json({ item: inserted })
  } catch (error) {
    console.error('Error in POST /api/customer-orders/[id]/items:', error)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}

