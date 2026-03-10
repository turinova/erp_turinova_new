import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/shipments/[id]/items
 * Get all items for a shipment
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch shipment items
    const { data: items, error } = await supabase
      .from('shipment_items')
      .select(`
        *,
        products:product_id(id, name, sku, model_number),
        product_suppliers:product_supplier_id(id, supplier_sku),
        vat:vat_id(id, name, kulcs),
        currencies:currency_id(id, name, code, symbol),
        purchase_order_items:purchase_order_item_id(id, quantity)
      `)
      .eq('shipment_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching shipment items:', error)
      return NextResponse.json(
        { error: 'Hiba a tételek lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ items: items || [] })
  } catch (error) {
    console.error('Error in shipment items GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/shipments/[id]/items
 * Update multiple shipment items (quantities, prices)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify shipment exists and get status
    const { data: shipment, error: shipmentError } = await supabase
      .from('shipments')
      .select('id, status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (shipmentError || !shipment) {
      return NextResponse.json(
        { error: 'Szállítmány nem található' },
        { status: 404 }
      )
    }

    // Can only update items if status is 'waiting'
    if (shipment.status !== 'waiting') {
      return NextResponse.json(
        { error: 'Csak várakozó szállítmány tételei szerkeszthetők' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { updates } = body

    if (!Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'Updates must be an array' },
        { status: 400 }
      )
    }

    // Update each item
    for (const update of updates) {
      const { id: itemId, received_quantity, unit_cost, vat_id } = update

      if (!itemId) {
        continue
      }

      const updateData: any = {}
      if (received_quantity !== undefined) updateData.received_quantity = received_quantity
      if (unit_cost !== undefined) updateData.unit_cost = unit_cost
      if (vat_id !== undefined) updateData.vat_id = vat_id

      const { error: updateError } = await supabase
        .from('shipment_items')
        .update(updateData)
        .eq('id', itemId)
        .eq('shipment_id', id)

      if (updateError) {
        console.error('Error updating shipment item:', updateError)
        return NextResponse.json(
          { error: `Hiba a tétel frissítésekor: ${updateError.message}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in shipment items PATCH API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/shipments/[id]/items
 * Add a new unexpected item to shipment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify shipment exists and get status
    const { data: shipment, error: shipmentError } = await supabase
      .from('shipments')
      .select('id, status, currency_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (shipmentError || !shipment) {
      return NextResponse.json(
        { error: 'Szállítmány nem található' },
        { status: 404 }
      )
    }

    // Can only add items if status is 'waiting'
    if (shipment.status !== 'waiting') {
      return NextResponse.json(
        { error: 'Csak várakozó szállítmányhoz adhat hozzá tételeket' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      product_id,
      received_quantity,
      unit_cost,
      vat_id,
      currency_id
    } = body

    // Validation
    if (!product_id || received_quantity === undefined || !unit_cost || !vat_id) {
      return NextResponse.json(
        { error: 'Termék, mennyiség, egységár és ÁFA kötelező' },
        { status: 400 }
      )
    }

    // Create new shipment item
    const { data: newItem, error: insertError } = await supabase
      .from('shipment_items')
      .insert({
        shipment_id: id,
        purchase_order_item_id: null,
        product_id,
        expected_quantity: 0, // No goal for unexpected items
        received_quantity,
        unit_cost,
        vat_id,
        currency_id: currency_id || shipment.currency_id,
        is_unexpected: true
      })
      .select(`
        *,
        products:product_id(id, name, sku, model_number),
        vat:vat_id(id, name, kulcs)
      `)
      .single()

    if (insertError) {
      console.error('Error creating shipment item:', insertError)
      return NextResponse.json(
        { error: insertError.message || 'Hiba a tétel létrehozásakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ item: newItem }, { status: 201 })
  } catch (error) {
    console.error('Error in shipment items POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
