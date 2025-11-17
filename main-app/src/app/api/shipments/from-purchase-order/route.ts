import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const purchase_order_id = body?.purchase_order_id as string | undefined
    if (!purchase_order_id) {
      return NextResponse.json({ error: 'purchase_order_id required' }, { status: 400 })
    }

    // Load PO
    const { data: po, error: poErr } = await supabaseServer
      .from('purchase_orders')
      .select('id, status, warehouse_id, partner_id, deleted_at')
      .eq('id', purchase_order_id)
      .single()

    if (poErr || !po || po.deleted_at) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    // Enforce "confirmed" status
    if (po.status !== 'confirmed') {
      return NextResponse.json(
        { error: 'Shipment can only be created from a confirmed purchase order.' },
        { status: 400 }
      )
    }

    // Only one shipment per PO (non-deleted)
    const { data: existing, error: existsErr } = await supabaseServer
      .from('shipments')
      .select('id')
      .eq('purchase_order_id', po.id)
      .is('deleted_at', null)
      .limit(1)

    if (!existsErr && existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'Shipment already exists for this purchase order.' },
        { status: 400 }
      )
    }

    // Create draft shipment
    const { data: shipment, error: createErr } = await supabaseServer
      .from('shipments')
      .insert({
        purchase_order_id: po.id,
        warehouse_id: po.warehouse_id,
        partner_id: po.partner_id,
        status: 'draft'
      })
      .select('id, purchase_order_id, status, warehouse_id, partner_id, created_at')
      .single()

    if (createErr || !shipment) {
      return NextResponse.json({ error: 'Failed to create shipment' }, { status: 500 })
    }

    // Fetch all PO items
    const { data: poItems, error: poItemsErr } = await supabaseServer
      .from('purchase_order_items')
      .select('id')
      .eq('purchase_order_id', po.id)
      .is('deleted_at', null)

    if (poItemsErr) {
      console.error('Error fetching PO items:', poItemsErr)
      // Continue anyway - shipment is created, items can be added manually
    } else if (poItems && poItems.length > 0) {
      // Create shipment_items for all PO items with quantity_received = 0
      const shipmentItems = poItems.map((poi: any) => ({
        shipment_id: shipment.id,
        purchase_order_item_id: poi.id,
        quantity_received: 0
      }))

      const { error: itemsErr } = await supabaseServer
        .from('shipment_items')
        .insert(shipmentItems)

      if (itemsErr) {
        console.error('Error creating shipment items:', itemsErr)
        // Continue anyway - shipment is created, items can be added manually
      }
    }

    return NextResponse.json(shipment, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


