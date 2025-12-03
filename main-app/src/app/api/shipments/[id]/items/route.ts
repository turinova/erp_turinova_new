import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// PATCH /api/shipments/[id]/items - update shipment items
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const updates = Array.isArray(body?.updates) ? body.updates : []

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Nincs frissítendő tétel' }, { status: 400 })
    }

    // Update each shipment item
    for (const upd of updates) {
      // Handle adding new item (no id, has action: 'add')
      if (upd.action === 'add') {
        // Validate required fields for new item
        if (!upd.quantity_received || upd.net_price === undefined || !upd.vat_id || !upd.currency_id || !upd.units_id || !upd.accessory_id) {
          return NextResponse.json({ error: 'Új tétel hozzáadásához szükséges: accessory_id, quantity_received, net_price, vat_id, currency_id, units_id' }, { status: 400 })
        }

        // Get the purchase_order_id and shipment status
        const { data: shipment, error: shipmentErr } = await supabaseServer
          .from('shipments')
          .select('purchase_order_id, status')
          .eq('id', id)
          .single()

        if (shipmentErr || !shipment) {
          console.error('Error fetching shipment:', shipmentErr)
          return NextResponse.json({ error: 'Szállítmány nem található' }, { status: 404 })
        }

        // Check if shipment is in draft status
        if (shipment.status !== 'draft') {
          return NextResponse.json({ 
            error: `Csak vázlat státuszú szállítmányhoz lehet új tételt hozzáadni (jelenlegi státusz: ${shipment.status})` 
          }, { status: 400 })
        }

        // Check if PO already has this accessory (to avoid duplicates)
        const { data: existingPoItem } = await supabaseServer
          .from('purchase_order_items')
          .select('id')
          .eq('purchase_order_id', shipment.purchase_order_id)
          .eq('accessory_id', upd.accessory_id)
          .is('deleted_at', null)
          .maybeSingle()

        let poItemId: string

        if (existingPoItem) {
          // Use existing PO item
          poItemId = existingPoItem.id
          console.log(`[BARCODE ADD] Using existing PO item for accessory: ${upd.accessory_id}`)
        } else {
          // Create a new purchase_order_item for this accessory
          const { data: newPoItem, error: poiErr } = await supabaseServer
            .from('purchase_order_items')
            .insert({
              purchase_order_id: shipment.purchase_order_id,
              product_type: 'accessory',
              accessory_id: upd.accessory_id,
              quantity: Number(upd.quantity_received), // Match scanned quantity
              net_price: Math.round(Number(upd.net_price) || 0),
              vat_id: upd.vat_id,
              currency_id: upd.currency_id,
              units_id: upd.units_id,
              description: upd.note || 'Vonalkóddal hozzáadva'
            })
            .select('id')
            .single()

          if (poiErr || !newPoItem) {
            console.error('Error creating PO item:', poiErr)
            return NextResponse.json({ 
              error: `Hiba a PO tétel létrehozásakor: ${poiErr?.message || 'Ismeretlen hiba'}` 
            }, { status: 500 })
          }
          
          poItemId = newPoItem.id
          console.log(`[BARCODE ADD] Created new PO item for accessory: ${upd.accessory_id}`)
        }

        // Now create the shipment_item and return the full item details
        const { data: newShipmentItem, error: insertErr } = await supabaseServer
          .from('shipment_items')
          .insert({
            shipment_id: id,
            purchase_order_item_id: poItemId,
            quantity_received: Number(upd.quantity_received),
            note: upd.note || null
          })
          .select('id, purchase_order_item_id, quantity_received, note')
          .single()

        if (insertErr || !newShipmentItem) {
          console.error('Error inserting shipment item:', insertErr)
          return NextResponse.json({ error: 'Hiba a tétel hozzáadásakor: ' + insertErr.message }, { status: 500 })
        }

        // Get accessory details for the response
        const { data: accessory } = await supabaseServer
          .from('accessories')
          .select('name, sku')
          .eq('id', upd.accessory_id)
          .single()

        // Return the created item details
        return NextResponse.json({ 
          success: true,
          item: {
            id: newShipmentItem.id,
            purchase_order_item_id: newShipmentItem.purchase_order_item_id,
            product_name: accessory?.name || 'Unknown',
            sku: accessory?.sku || '',
            quantity_received: newShipmentItem.quantity_received,
            target_quantity: Number(upd.quantity_received), // Matches PO item quantity
            net_price: Math.round(Number(upd.net_price) || 0),
            vat_id: upd.vat_id,
            currency_id: upd.currency_id,
            units_id: upd.units_id,
            note: newShipmentItem.note
          }
        })
      }

      if (!upd.id) {
        continue
      }
      // Handle soft delete
      if (upd.deleted) {
        // Get the purchase_order_item_id before deleting
        const { data: shipmentItem, error: fetchError } = await supabaseServer
          .from('shipment_items')
          .select('purchase_order_item_id')
          .eq('id', upd.id)
          .eq('shipment_id', id)
          .single()

        if (fetchError) {
          console.error('Error fetching shipment item:', fetchError)
          return NextResponse.json({ error: 'Tétel nem található' }, { status: 404 })
        }

        // Soft-delete the shipment_item
        const { error } = await supabaseServer
          .from('shipment_items')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', upd.id)
          .eq('shipment_id', id)
        if (error) {
          console.error('Error deleting shipment item:', error)
          return NextResponse.json({ error: 'Hiba a tétel törlésekor' }, { status: 500 })
        }

        // Also soft-delete the corresponding purchase_order_item (since 1 PO = 1 Shipment)
        if (shipmentItem.purchase_order_item_id) {
          const { error: poItemError } = await supabaseServer
            .from('purchase_order_items')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', shipmentItem.purchase_order_item_id)
          
          if (poItemError) {
            console.error('Error deleting purchase_order_item:', poItemError)
            // Don't fail the whole request, but log it
          }
        }
      } else if (upd.quantity_received !== undefined) {
        // Get the purchase_order_item_id first
        const { data: si, error: siErr } = await supabaseServer
          .from('shipment_items')
          .select('purchase_order_item_id')
          .eq('id', upd.id)
          .eq('shipment_id', id)
          .is('deleted_at', null)
          .single()

        if (siErr || !si) {
          console.error('Error fetching shipment item:', siErr)
          return NextResponse.json({ error: 'Tétel nem található' }, { status: 404 })
        }

        // Update shipment_item
        const { error: updateErr } = await supabaseServer
          .from('shipment_items')
          .update({
            quantity_received: Number(upd.quantity_received),
            note: upd.note || null
          })
          .eq('id', upd.id)
          .eq('shipment_id', id)
          .is('deleted_at', null)

        if (updateErr) {
          console.error('Error updating shipment item:', updateErr)
          return NextResponse.json({ error: 'Hiba a tétel frissítésekor' }, { status: 500 })
        }

        // Update purchase_order_item net_price if provided
        if (upd.net_price !== undefined) {
          const { error: poiErr } = await supabaseServer
            .from('purchase_order_items')
            .update({
              net_price: Math.round(Number(upd.net_price) || 0)
            })
            .eq('id', si.purchase_order_item_id)
            .is('deleted_at', null)

          if (poiErr) {
            console.error('Error updating PO item net_price:', poiErr)
            // Don't fail the whole request, just log it
          }
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Error in PATCH /api/shipments/[id]/items', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/shipments/[id]/items - add new items to shipment
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const items = Array.isArray(body?.items) ? body.items : []

    if (items.length === 0) {
      return NextResponse.json({ error: 'Nincs tétel a hozzáadáshoz' }, { status: 400 })
    }

    // Validate and prepare items
    const prepared = []
    for (const it of items) {
      if (!it.purchase_order_item_id || !it.quantity_received || it.quantity_received <= 0) {
        return NextResponse.json({ error: 'Minden tételhez purchase_order_item_id és quantity_received szükséges.' }, { status: 400 })
      }
      prepared.push({
        shipment_id: id,
        purchase_order_item_id: it.purchase_order_item_id,
        quantity_received: Number(it.quantity_received),
        note: it.note || null
      })
    }

    const { error } = await supabaseServer
      .from('shipment_items')
      .insert(prepared)

    if (error) {
      console.error('Error inserting shipment items:', error)
      return NextResponse.json({ error: 'Hiba a tételek hozzáadásakor' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Error in POST /api/shipments/[id]/items', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

