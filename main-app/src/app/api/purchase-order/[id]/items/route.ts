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


