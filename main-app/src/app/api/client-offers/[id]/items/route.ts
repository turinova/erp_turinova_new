import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// POST - Add item to client offer
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const {
      item_type,
      material_id,
      accessory_id,
      linear_material_id,
      fee_type_id,
      product_name,
      sku,
      unit,
      quantity,
      unit_price_net,
      unit_price_gross,
      vat_id,
      vat_percentage,
      total_net,
      total_vat,
      total_gross,
      notes
    } = body

    // Get current max sort_order
    const { data: existingItems } = await supabaseAdmin
      .from('client_offers_items')
      .select('sort_order')
      .eq('client_offer_id', id)
      .is('deleted_at', null)
      .order('sort_order', { ascending: false })
      .limit(1)

    const nextSortOrder = existingItems && existingItems.length > 0 
      ? (existingItems[0].sort_order || 0) + 1 
      : 0

    const { data: item, error } = await supabaseAdmin
      .from('client_offers_items')
      .insert({
        client_offer_id: id,
        item_type,
        material_id: material_id || null,
        accessory_id: accessory_id || null,
        linear_material_id: linear_material_id || null,
        fee_type_id: fee_type_id || null,
        product_name,
        sku: sku || null,
        unit: unit || null,
        quantity: quantity || 1,
        unit_price_net: unit_price_net || 0,
        unit_price_gross: unit_price_gross || 0,
        vat_id: vat_id || null,
        vat_percentage: vat_percentage || null,
        total_net: total_net || 0,
        total_vat: total_vat || 0,
        total_gross: total_gross || 0,
        notes: notes || null,
        sort_order: nextSortOrder
      })
      .select()
      .single()

    if (error || !item) {
      console.error('Error adding item:', error)
      return NextResponse.json(
        { error: 'Hiba a tétel hozzáadásakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, item })
  } catch (error) {
    console.error('Error adding item:', error)
    return NextResponse.json(
      { error: 'Hiba a tétel hozzáadásakor' },
      { status: 500 }
    )
  }
}

// PATCH - Update item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { item_id, quantity, unit_price_gross } = body

    if (!item_id) {
      return NextResponse.json(
        { error: 'Tétel ID kötelező' },
        { status: 400 }
      )
    }

    // Check if offer is accepted (locked)
    const { data: offer } = await supabaseAdmin
      .from('client_offers')
      .select('status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (offer?.status === 'accepted') {
      return NextResponse.json(
        { error: 'Az elfogadott ajánlat nem módosítható' },
        { status: 400 }
      )
    }

    // Get current item to recalculate
    const { data: currentItem, error: getError } = await supabaseAdmin
      .from('client_offers_items')
      .select('*')
      .eq('id', item_id)
      .eq('client_offer_id', id)
      .is('deleted_at', null)
      .single()

    if (getError || !currentItem) {
      return NextResponse.json(
        { error: 'Tétel nem található' },
        { status: 404 }
      )
    }

    // Calculate new totals
    const newQuantity = quantity !== undefined ? quantity : currentItem.quantity
    const newUnitPriceGross = unit_price_gross !== undefined ? unit_price_gross : currentItem.unit_price_gross
    const vatPercentage = currentItem.vat_percentage || 0
    const newUnitPriceNet = newUnitPriceGross / (1 + vatPercentage / 100)
    const newTotalGross = Math.round(newQuantity * newUnitPriceGross)
    const newTotalNet = Math.round(newQuantity * newUnitPriceNet)
    const newTotalVat = newTotalGross - newTotalNet

    const { data: item, error: updateError } = await supabaseAdmin
      .from('client_offers_items')
      .update({
        quantity: newQuantity,
        unit_price_gross: Math.round(newUnitPriceGross),
        unit_price_net: Math.round(newUnitPriceNet),
        total_gross: newTotalGross,
        total_net: newTotalNet,
        total_vat: newTotalVat
      })
      .eq('id', item_id)
      .select()
      .single()

    if (updateError || !item) {
      console.error('Error updating item:', updateError)
      return NextResponse.json(
        { error: 'Hiba a tétel frissítésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, item })
  } catch (error) {
    console.error('Error updating item:', error)
    return NextResponse.json(
      { error: 'Hiba a tétel frissítésekor' },
      { status: 500 }
    )
  }
}

// DELETE - Remove item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const item_id = searchParams.get('item_id')

    if (!item_id) {
      return NextResponse.json(
        { error: 'Tétel ID kötelező' },
        { status: 400 }
      )
    }

    // Check if offer is accepted (locked)
    const { data: offer } = await supabaseAdmin
      .from('client_offers')
      .select('status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (offer?.status === 'accepted') {
      return NextResponse.json(
        { error: 'Az elfogadott ajánlat nem módosítható' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('client_offers_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', item_id)
      .eq('client_offer_id', id)

    if (error) {
      console.error('Error deleting item:', error)
      return NextResponse.json(
        { error: 'Hiba a tétel törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting item:', error)
    return NextResponse.json(
      { error: 'Hiba a tétel törlésekor' },
      { status: 500 }
    )
  }
}

