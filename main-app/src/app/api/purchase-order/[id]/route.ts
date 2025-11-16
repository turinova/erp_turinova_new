import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET /api/purchase-order/[id] - header + items
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { data: po, error } = await supabaseServer
      .from('purchase_orders')
      .select(`
        id, po_number, status, partner_id, partners:partner_id(name),
        warehouse_id, order_date, expected_date, note, created_at, updated_at,
        purchase_order_items (
          id, product_type, accessory_id, material_id, linear_material_id,
          quantity, net_price, vat_id, currency_id, units_id, description,
          accessories:accessory_id ( sku )
        )
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) {
      console.error('GET /api/purchase-order/[id] select error:', error)
      return NextResponse.json({ error: 'PO lekérdezési hiba' }, { status: 500 })
    }

    if (!po) {
      return NextResponse.json({ error: 'PO nem található' }, { status: 404 })
    }

    // Totals
    const { data: vatRows } = await supabaseServer.from('vat').select('id, kulcs')
    const vatMap = new Map<string, number>((vatRows || []).map(r => [r.id, r.kulcs || 0]))

    let itemsCount = 0
    let totalQty = 0
    let totalNet = 0
    let totalVat = 0
    let totalGross = 0
    for (const item of po.purchase_order_items || []) {
      itemsCount += 1
      const qty = Number(item.quantity) || 0
      totalQty += qty
      const lineNet = (Number(item.net_price) || 0) * qty
      totalNet += lineNet
      const vatPercent = vatMap.get(item.vat_id) || 0
      const lineVat = Math.round(lineNet * (vatPercent / 100))
      totalVat += lineVat
      totalGross += lineNet + lineVat
    }

    return NextResponse.json({
      header: {
        id: po.id,
        po_number: po.po_number,
        status: po.status,
        partner_id: po.partner_id,
        partner_name: po.partners?.name || '',
        warehouse_id: po.warehouse_id,
        order_date: po.order_date,
        expected_date: po.expected_date,
        note: po.note,
        created_at: po.created_at,
        updated_at: po.updated_at,
        shipments_count: (po.shipments || []).length
      },
      items: po.purchase_order_items || [],
      summary: {
        itemsCount,
        totalQty,
        totalNet,
        totalVat,
        totalGross
      }
    })
  } catch (e) {
    console.error('Error in GET /api/purchase-order/[id]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/purchase-order/[id] - update header (draft only)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    const { data: existing, error: getErr } = await supabaseServer
      .from('purchase_orders')
      .select('status')
      .eq('id', id)
      .single()
    if (getErr || !existing) {
      return NextResponse.json({ error: 'PO nem található' }, { status: 404 })
    }
    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Csak vázlat státusz módosítható' }, { status: 400 })
    }

    const { partner_id, warehouse_id, order_date, expected_date, note } = body
    const { error } = await supabaseServer
      .from('purchase_orders')
      .update({
        partner_id: partner_id,
        warehouse_id: warehouse_id,
        order_date: order_date,
        expected_date: expected_date,
        note: note
      })
      .eq('id', id)

    if (error) {
      console.error('Error updating PO:', error)
      return NextResponse.json({ error: 'Hiba a frissítéskor' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Error in PATCH /api/purchase-order/[id]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


