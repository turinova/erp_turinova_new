import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET /api/purchase-order - list all non-deleted POs with basic aggregates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // optional
    const search = (searchParams.get('search') || '').trim() // partner name search

    let query = supabaseServer
      .from('purchase_orders')
      .select(`
        id,
        po_number,
        status,
        partner_id,
        partners:partner_id(name),
        warehouse_id,
        order_date,
        expected_date,
        created_at,
        email_sent,
        email_sent_at,
        items:purchase_order_items(deleted_at),
        net_total:purchase_order_items!purchase_order_items_purchase_order_id_fkey(id, net_price, quantity, deleted_at)
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    if (search) {
      query = query.ilike('partners.name', `%${search}%`)
    }

    const { data, error } = await query
    if (error) {
      console.error('Error listing purchase orders:', error)
      return NextResponse.json({ error: 'Failed to fetch purchase orders' }, { status: 500 })
    }

    // Fetch all shipments for the purchase orders
    const poIds = (data || []).map((row: any) => row.id)
    const { data: allShipments } = await supabaseServer
      .from('shipments')
      .select('id, shipment_number, purchase_order_id')
      .in('purchase_order_id', poIds)
      .is('deleted_at', null)

    // Group shipments by purchase_order_id
    const shipmentsByPo = new Map<string, Array<{ id: string; number: string }>>()
    if (allShipments) {
      allShipments.forEach((shipment: any) => {
        if (shipment.purchase_order_id && shipment.shipment_number) {
          if (!shipmentsByPo.has(shipment.purchase_order_id)) {
            shipmentsByPo.set(shipment.purchase_order_id, [])
          }
          shipmentsByPo.get(shipment.purchase_order_id)!.push({
            id: shipment.id,
            number: shipment.shipment_number
          })
        }
      })
    }

    // Check for stock movements
    const allShipmentIds = Array.from(new Set(Array.from(shipmentsByPo.values()).flat().map(s => s.id)))
    const { data: stockMovements } = allShipmentIds.length > 0
      ? await supabaseServer
          .from('stock_movements')
          .select('source_id')
          .eq('source_type', 'purchase_receipt')
          .in('source_id', allShipmentIds)
      : { data: [] }

    const shipmentIdsWithStockMovements = new Set(
      (stockMovements || []).map((sm: any) => sm.source_id)
    )

    // Fetch received quantities for all POs (for non-draft POs)
    const { data: receivedData } = poIds.length > 0
      ? await supabaseServer
          .from('shipment_items')
          .select(`
            purchase_order_item_id,
            quantity_received,
            shipments!inner(purchase_order_id, status, deleted_at)
          `)
          .in('shipments.purchase_order_id', poIds)
          .is('deleted_at', null)
          .eq('shipments.status', 'received')
          .is('shipments.deleted_at', null)
      : { data: [] }

    // Group received quantities by purchase_order_item_id
    const receivedByPoItem = new Map<string, number>()
    if (receivedData) {
      receivedData.forEach((row: any) => {
        const poItemId = row.purchase_order_item_id
        const qty = Number(row.quantity_received) || 0
        receivedByPoItem.set(poItemId, (receivedByPoItem.get(poItemId) || 0) + qty)
      })
    }

    // Compute net totals and counts client-side from joined data
    const result = (data || []).map((row: any) => {
      // Filter out soft-deleted items
      const activeItems = Array.isArray(row.items) ? row.items.filter((item: any) => !item.deleted_at) : []
      const itemsCount = activeItems.length
      
      // Get shipments for this PO
      const shipmentNumbers = shipmentsByPo.get(row.id) || []
      
      // Check if any shipment has stock movements
      const poShipmentIds = shipmentNumbers.map((s: { id: string }) => s.id)
      const hasStockMovements = poShipmentIds.some((sid: string) => 
        shipmentIdsWithStockMovements.has(sid)
      )
      
      // Sum net_price * quantity across non-deleted purchase_order_items rows (ordered total)
      const activeNetTotalItems = Array.isArray(row.net_total) 
        ? row.net_total.filter((it: any) => !it.deleted_at) 
        : []
      const netTotal = activeNetTotalItems.reduce((sum: number, it: any) => {
        const unit = Number(it?.net_price) || 0
        const qty = Number(it?.quantity) || 0
        return sum + unit * qty
      }, 0)
      
      // Calculate received total (net_price * quantity_received)
      const receivedNetTotal = activeNetTotalItems.reduce((sum: number, it: any) => {
        const unit = Number(it?.net_price) || 0
        const qtyReceived = receivedByPoItem.get(it.id) || 0
        return sum + (unit * qtyReceived)
      }, 0)
      return {
        id: row.id,
        po_number: row.po_number,
        status: row.status,
        partner_id: row.partner_id,
        partner_name: row.partners?.name || '',
        warehouse_id: row.warehouse_id,
        items_count: itemsCount,
        net_total: netTotal,
        received_net_total: receivedNetTotal,
        created_at: row.created_at,
        expected_date: row.expected_date,
        email_sent: row.email_sent || false,
        email_sent_at: row.email_sent_at,
        shipments: shipmentNumbers,
        has_stock_movements: hasStockMovements
      }
    })

    return NextResponse.json({ purchase_orders: result })
  } catch (e) {
    console.error('Error in GET /api/purchase-order', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/purchase-order - create PO (draft)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { partner_id, warehouse_id, order_date, expected_date, note } = body

    if (!partner_id || !warehouse_id) {
      return NextResponse.json({ error: 'partner_id és warehouse_id kötelező' }, { status: 400 })
    }

    const { data, error } = await supabaseServer
      .from('purchase_orders')
      .insert({
        partner_id,
        warehouse_id,
        order_date: order_date || new Date().toISOString().slice(0, 10),
        expected_date: expected_date || null,
        status: 'draft',
        note: note || null
      })
      .select('id, po_number')
      .single()

    if (error) {
      console.error('Error creating purchase order:', error)
      return NextResponse.json({ error: 'Hiba a PO létrehozásakor' }, { status: 500 })
    }

    return NextResponse.json({ id: data.id, po_number: data.po_number }, { status: 201 })
  } catch (e) {
    console.error('Error in POST /api/purchase-order', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


