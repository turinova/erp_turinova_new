import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// POST /api/purchase-order/[id]/items - add multiple items
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const items = Array.isArray(body?.items) ? body.items : []
    if (items.length === 0) {
      return NextResponse.json({ error: 'Nincs tétel a mentéshez' }, { status: 400 })
    }

    // Validate FK per line and required fields
    const prepared = []
    for (const it of items) {
      const fkCount = [it.accessory_id, it.material_id, it.linear_material_id].filter(Boolean).length
      if (fkCount !== 1) {
        return NextResponse.json({ error: 'Minden tételhez pontosan 1 idegen kulcs szükséges (accessory/material/linear_material).' }, { status: 400 })
      }
      if (!it.product_type || !it.quantity || it.quantity <= 0 || it.net_price < 0 || !it.vat_id || !it.currency_id || !it.units_id) {
        return NextResponse.json({ error: 'Hiányzó vagy érvénytelen mezők a tételnél.' }, { status: 400 })
      }
      prepared.push({
        purchase_order_id: id,
        product_type: it.product_type,
        accessory_id: it.accessory_id || null,
        material_id: it.material_id || null,
        linear_material_id: it.linear_material_id || null,
        quantity: it.quantity,
        net_price: Math.round(Number(it.net_price) || 0),
        vat_id: it.vat_id,
        currency_id: it.currency_id,
        units_id: it.units_id,
        description: it.description || ''
      })
    }

    const { error } = await supabaseServer
      .from('purchase_order_items')
      .insert(prepared)
    if (error) {
      console.error('Error inserting PO items:', error)
      return NextResponse.json({ error: 'Hiba a tételek mentésekor' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Error in POST /api/purchase-order/[id]/items', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/purchase-order/[id]/items - update existing item
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { item_id, ...updates } = body

    if (!item_id) {
      return NextResponse.json({ error: 'item_id kötelező' }, { status: 400 })
    }

    // Check PO status - only allow if draft
    const { data: po } = await supabaseServer
      .from('purchase_orders')
      .select('status')
      .eq('id', id)
      .single()

    if (!po || po.status !== 'draft') {
      return NextResponse.json({ error: 'Csak vázlat státuszú PO tételei módosíthatók' }, { status: 400 })
    }

    // Validate FK if provided
    if (updates.accessory_id !== undefined || updates.material_id !== undefined || updates.linear_material_id !== undefined) {
      const fkCount = [
        updates.accessory_id,
        updates.material_id,
        updates.linear_material_id
      ].filter(Boolean).length
      if (fkCount !== 1) {
        return NextResponse.json({ error: 'Pontosan 1 idegen kulcs szükséges (accessory/material/linear_material).' }, { status: 400 })
      }
    }

    const prepared: any = {}
    if (updates.product_type !== undefined) prepared.product_type = updates.product_type
    if (updates.accessory_id !== undefined) prepared.accessory_id = updates.accessory_id || null
    if (updates.material_id !== undefined) prepared.material_id = updates.material_id || null
    if (updates.linear_material_id !== undefined) prepared.linear_material_id = updates.linear_material_id || null
    if (updates.quantity !== undefined) prepared.quantity = updates.quantity
    if (updates.net_price !== undefined) prepared.net_price = Math.round(Number(updates.net_price) || 0)
    if (updates.vat_id !== undefined) prepared.vat_id = updates.vat_id
    if (updates.currency_id !== undefined) prepared.currency_id = updates.currency_id
    if (updates.units_id !== undefined) prepared.units_id = updates.units_id
    if (updates.description !== undefined) prepared.description = updates.description || ''

    const { error } = await supabaseServer
      .from('purchase_order_items')
      .update(prepared)
      .eq('id', item_id)
      .eq('purchase_order_id', id)
      .is('deleted_at', null)

    if (error) {
      console.error('Error updating PO item:', error)
      return NextResponse.json({ error: 'Hiba a tétel frissítésekor' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Error in PATCH /api/purchase-order/[id]/items', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/purchase-order/[id]/items - delete item(s)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const itemIds = Array.isArray(body?.item_ids) ? body.item_ids : []

    if (itemIds.length === 0) {
      return NextResponse.json({ error: 'Nincs törlendő tétel' }, { status: 400 })
    }

    // Check PO status - only allow if draft
    const { data: po } = await supabaseServer
      .from('purchase_orders')
      .select('status')
      .eq('id', id)
      .single()

    if (!po || po.status !== 'draft') {
      return NextResponse.json({ error: 'Csak vázlat státuszú PO tételei törölhetők' }, { status: 400 })
    }

    // Soft delete items
    const { error } = await supabaseServer
      .from('purchase_order_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('purchase_order_id', id)
      .in('id', itemIds)
      .is('deleted_at', null)

    if (error) {
      console.error('Error deleting PO items:', error)
      return NextResponse.json({ error: 'Hiba a tételek törlésekor' }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted_count: itemIds.length })
  } catch (e) {
    console.error('Error in DELETE /api/purchase-order/[id]/items', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


