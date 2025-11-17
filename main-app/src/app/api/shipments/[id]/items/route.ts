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
      if (!upd.id) {
        continue
      }
      // Handle soft delete
      if (upd.deleted) {
        const { error } = await supabaseServer
          .from('shipment_items')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', upd.id)
          .eq('shipment_id', id)
        if (error) {
          console.error('Error deleting shipment item:', error)
          return NextResponse.json({ error: 'Hiba a tétel törlésekor' }, { status: 500 })
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

