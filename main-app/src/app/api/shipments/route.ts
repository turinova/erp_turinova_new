import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET /api/shipments - list all non-deleted shipments with basic aggregates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // optional
    const search = (searchParams.get('search') || '').trim() // partner name search

    let query = supabaseServer
      .from('shipments')
      .select(`
        id,
        shipment_number,
        purchase_order_id,
        status,
        partner_id,
        partners:partner_id(name),
        warehouse_id,
        warehouses:warehouse_id(name),
        shipment_date,
        created_at,
        deleted_at,
        purchase_orders:purchase_order_id(po_number),
        items:shipment_items(count)
      `)
      .order('created_at', { ascending: false })

    // Handle status filter
    if (status && status !== 'all') {
      if (status === 'cancelled') {
        // Show soft-deleted shipments (deleted_at IS NOT NULL)
        query = query.not('deleted_at', 'is', null)
      } else {
        // Show non-deleted shipments with specific status
        query = query.is('deleted_at', null).eq('status', status)
      }
    } else {
      // Show all non-deleted shipments
      query = query.is('deleted_at', null)
    }
    if (search) {
      query = query.ilike('partners.name', `%${search}%`)
    }

    const { data, error } = await query
    if (error) {
      console.error('Error listing shipments:', error)
      return NextResponse.json({ error: 'Failed to fetch shipments' }, { status: 500 })
    }

    // Fetch VAT rates once
    const { data: vatRows } = await supabaseServer.from('vat').select('id, kulcs')
    const vatMap = new Map<string, number>((vatRows || []).map(r => [r.id, r.kulcs || 0]))

    // Fetch all shipment items with PO item details in one query
    const shipmentIds = (data || []).map((s: any) => s.id)
    const { data: allItems } = await supabaseServer
      .from('shipment_items')
      .select(`
        shipment_id,
        quantity_received,
        purchase_order_items:purchase_order_item_id(net_price, vat_id)
      `)
      .in('shipment_id', shipmentIds)
      .is('deleted_at', null)

    // Group items by shipment_id
    const itemsByShipment = new Map<string, any[]>()
    if (allItems) {
      allItems.forEach((item: any) => {
        const sid = item.shipment_id
        if (!itemsByShipment.has(sid)) {
          itemsByShipment.set(sid, [])
        }
        itemsByShipment.get(sid)!.push(item)
      })
    }

    // Check for stock movements
    const { data: stockMovements } = shipmentIds.length > 0
      ? await supabaseServer
          .from('stock_movements')
          .select('source_id')
          .eq('source_type', 'purchase_receipt')
          .in('source_id', shipmentIds)
      : { data: [] }

    const shipmentIdsWithStockMovements = new Set(
      (stockMovements || []).map((sm: any) => sm.source_id)
    )

    // Calculate totals for each shipment
    const shipments = (data || []).map((shipment: any) => {
      const itemsCount = shipment.items?.[0]?.count || 0
      const items = itemsByShipment.get(shipment.id) || []
      
      let netTotal = 0
      let grossTotal = 0

      items.forEach((item: any) => {
        const poi = item.purchase_order_items
        if (poi) {
          const qty = Number(item.quantity_received) || 0
          const netPrice = Number(poi.net_price) || 0
          // Szamlazz.hu requirement: Round net total to integer first
          const lineNet = Math.round(qty * netPrice)
          const vatPercent = vatMap.get(poi.vat_id) || 0
          // Round VAT from rounded net total
          const lineVat = Math.round(lineNet * (vatPercent / 100))
          // Gross = Net (integer) + VAT (integer) = integer
          const lineGross = lineNet + lineVat
          netTotal += lineNet
          grossTotal += lineGross
        }
      })

      const hasStockMovements = shipmentIdsWithStockMovements.has(shipment.id)

      return {
        id: shipment.id,
        shipment_number: shipment.shipment_number || '',
        po_number: shipment.purchase_orders?.po_number || '',
        purchase_order_id: shipment.purchase_order_id,
        status: shipment.status,
        partner_name: shipment.partners?.name || '',
        warehouse_name: shipment.warehouses?.name || '',
        items_count: itemsCount,
        net_total: netTotal,
        gross_total: grossTotal,
        created_at: shipment.created_at,
        shipment_date: shipment.shipment_date,
        deleted_at: shipment.deleted_at,
        has_stock_movements: hasStockMovements
      }
    })

    return NextResponse.json({ shipments })
  } catch (e) {
    console.error('Error in GET /api/shipments', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

