import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET /api/purchase-order/[id] - header + items
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { data: po, error } = await supabaseServer
      .from('purchase_orders')
      .select(`
        id, po_number, status, partner_id, partners:partner_id(name, email),
        warehouse_id, order_date, expected_date, note, created_at, updated_at,
        purchase_order_items (
          id, product_type, accessory_id, material_id, linear_material_id,
          quantity, net_price, vat_id, currency_id, units_id, description, deleted_at,
          accessories:accessory_id (name, sku),
          materials:material_id (name),
          linear_materials:linear_material_id (name)
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

    // Filter out soft-deleted items
    const activeItems = (po.purchase_order_items || []).filter((item: any) => !item.deleted_at)

    // Totals
    const { data: vatRows } = await supabaseServer.from('vat').select('id, kulcs')
    const vatMap = new Map<string, number>((vatRows || []).map(r => [r.id, r.kulcs || 0]))

    let itemsCount = 0
    let totalQty = 0
    let totalNet = 0
    let totalVat = 0
    let totalGross = 0
    for (const item of activeItems) {
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

    // Handle partners as array (Supabase returns arrays for joins)
    const partner = Array.isArray(po.partners) ? po.partners[0] : po.partners

    // Fetch received quantities for each PO item
    const poItemIds = activeItems.map((item: any) => item.id)
    let receivedQuantitiesMap = new Map<string, number>()
    
    if (poItemIds.length > 0) {
      const { data: receivedData } = await supabaseServer
        .from('shipment_items')
        .select(`
          purchase_order_item_id,
          quantity_received,
          shipments!inner(status, deleted_at)
        `)
        .in('purchase_order_item_id', poItemIds)
        .is('deleted_at', null)
        .eq('shipments.status', 'received')
        .is('shipments.deleted_at', null)

      // Sum received quantities per PO item
      if (receivedData) {
        receivedData.forEach((row: any) => {
          const poItemId = row.purchase_order_item_id
          const qty = Number(row.quantity_received) || 0
          receivedQuantitiesMap.set(poItemId, (receivedQuantitiesMap.get(poItemId) || 0) + qty)
        })
      }
    }

    // Transform items to use actual product names from related tables
    const transformedItems = activeItems.map((item: any) => {
      // Get actual product name from related table
      let productName = item.description || ''
      let productSku = ''
      
      if (item.accessory_id && item.accessories) {
        productName = item.accessories.name || item.description
        productSku = item.accessories.sku || ''
      } else if (item.material_id && item.materials) {
        productName = item.materials.name || item.description
        productSku = '' // Materials don't have SKU
      } else if (item.linear_material_id && item.linear_materials) {
        productName = item.linear_materials.name || item.description
        productSku = '' // Linear materials don't have SKU
      }
      
      return {
        ...item,
        description: productName, // Override with actual product name
        sku: productSku,
        quantity_received: receivedQuantitiesMap.get(item.id) || 0
      }
    })

    return NextResponse.json({
      header: {
        id: po.id,
        po_number: po.po_number,
        status: po.status,
        partner_id: po.partner_id,
        partner_name: partner?.name || '',
        partner_email: partner?.email || '',
        warehouse_id: po.warehouse_id,
        order_date: po.order_date,
        expected_date: po.expected_date,
        note: po.note,
        created_at: po.created_at,
        updated_at: po.updated_at,
        shipments_count: 0 // Not fetched in this query
      },
      items: transformedItems,
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


