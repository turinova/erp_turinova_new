import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET /api/shipments/[id] - shipment with PO and items
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { data: shipment, error } = await supabaseServer
      .from('shipments')
      .select(`
        id, purchase_order_id, warehouse_id, partner_id, shipment_date, status, note, created_at, updated_at,
        purchase_orders:purchase_order_id (
          id, po_number, created_at,
          partners:partner_id (name),
          warehouses:warehouse_id (name)
        ),
        warehouses:warehouse_id (name),
        partners:partner_id (name)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) {
      console.error('GET /api/shipments/[id] select error:', error)
      return NextResponse.json({ error: 'Szállítmány lekérdezési hiba' }, { status: 500 })
    }

    if (!shipment) {
      return NextResponse.json({ error: 'Szállítmány nem található' }, { status: 404 })
    }

    // Fetch shipment items with PO item details and related product data
    const { data: shipmentItems, error: itemsError } = await supabaseServer
      .from('shipment_items')
      .select(`
        id, purchase_order_item_id, quantity_received, note,
        purchase_order_items:purchase_order_item_id (
          id, description, quantity, net_price, vat_id, currency_id, units_id,
          product_type, accessory_id, material_id, linear_material_id,
          accessories:accessory_id (name, sku),
          materials:material_id (name),
          linear_materials:linear_material_id (name)
        )
      `)
      .eq('shipment_id', id)
      .is('deleted_at', null)

    if (itemsError) {
      console.error('GET /api/shipments/[id] items error:', itemsError)
      return NextResponse.json({ error: 'Tételek lekérdezési hiba' }, { status: 500 })
    }

    // Fetch VAT rates for calculations
    const { data: vatRows } = await supabaseServer.from('vat').select('id, kulcs')
    const vatMap = new Map<string, number>((vatRows || []).map(r => [r.id, r.kulcs || 0]))

    // Process items with calculations
    const items = (shipmentItems || []).map((si: any) => {
      const poi = si.purchase_order_items
      
      // Get product name from related table or fallback to description
      let productName = poi?.description || ''
      if (poi?.accessory_id && poi?.accessories?.name) {
        productName = poi.accessories.name
      } else if (poi?.material_id && poi?.materials?.name) {
        productName = poi.materials.name
      } else if (poi?.linear_material_id && poi?.linear_materials?.name) {
        productName = poi.linear_materials.name
      }
      
      // Get SKU (only accessories have SKU)
      const sku = (poi?.accessory_id && poi?.accessories?.sku) ? poi.accessories.sku : ''
      
      const targetQty = Number(poi?.quantity) || 0
      const receivedQty = Number(si.quantity_received) || 0
      const netPrice = Number(poi?.net_price) || 0
      const vatPercent = vatMap.get(poi?.vat_id) || 0
      const lineNet = receivedQty * netPrice
      const lineVat = Math.round(lineNet * (vatPercent / 100))
      const lineGross = lineNet + lineVat

      return {
        id: si.id,
        purchase_order_item_id: si.purchase_order_item_id,
        product_name: productName,
        sku,
        quantity_received: receivedQty,
        target_quantity: targetQty,
        net_price: netPrice,
        net_total: lineNet,
        gross_total: lineGross,
        vat_id: poi?.vat_id,
        currency_id: poi?.currency_id,
        units_id: poi?.units_id,
        note: si.note
      }
    })

    // Calculate totals
    const totals = items.reduce((acc, it) => {
      acc.totalNet += it.net_total
      acc.totalGross += it.gross_total
      return acc
    }, { totalNet: 0, totalGross: 0 })

    // Fetch stock movement numbers for this shipment
    const { data: stockMovements } = await supabaseServer
      .from('stock_movements')
      .select('stock_movement_number')
      .eq('source_id', id)
      .eq('source_type', 'purchase_receipt')
      .order('created_at', { ascending: true })

    const stockMovementNumbers = (stockMovements || []).map((sm: any) => sm.stock_movement_number)

    // Fetch workers who received this shipment
    const { data: receiptWorkers } = await supabaseServer
      .from('shipment_receipt_workers')
      .select(`
        worker_id,
        received_at,
        workers:worker_id (
          id,
          name,
          nickname,
          color
        )
      `)
      .eq('shipment_id', id)
      .order('received_at', { ascending: true })

    const workers = (receiptWorkers || []).map((rw: any) => ({
      id: rw.workers?.id || rw.worker_id,
      name: rw.workers?.name || '',
      nickname: rw.workers?.nickname || null,
      color: rw.workers?.color || '#1976d2',
      received_at: rw.received_at
    }))

    return NextResponse.json({
      header: {
        id: shipment.id,
        purchase_order_id: shipment.purchase_order_id,
        po_number: (shipment.purchase_orders as any)?.po_number || '',
        po_created_at: (shipment.purchase_orders as any)?.created_at || '',
        partner_id: shipment.partner_id,
        partner_name: (shipment.partners as any)?.name || '',
        warehouse_id: shipment.warehouse_id,
        warehouse_name: (shipment.warehouses as any)?.name || '',
        shipment_date: shipment.shipment_date,
        status: shipment.status,
        note: shipment.note,
        created_at: shipment.created_at,
        stock_movement_numbers: stockMovementNumbers,
        receipt_workers: workers
      },
      items,
      summary: totals
    })
  } catch (e) {
    console.error('Error in GET /api/shipments/[id]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

