import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/purchase-orders/[id]/items
 * Get all items for a purchase order
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

    // Verify PO exists
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('id, status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (poError || !po) {
      return NextResponse.json(
        { error: 'Beszerzési rendelés nem található' },
        { status: 404 }
      )
    }

    // Fetch items
    const { data: items, error } = await supabase
      .from('purchase_order_items')
      .select(`
        *,
        products:product_id(id, name, sku, gtin, internal_barcode),
        product_suppliers:product_supplier_id(id, supplier_sku, supplier_barcode),
        vat:vat_id(id, name, kulcs),
        currencies:currency_id(id, name, code, symbol),
        units:unit_id(id, name, shortform)
      `)
      .eq('purchase_order_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching purchase order items:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a rendelési tételek lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ items: items || [] })
  } catch (error) {
    console.error('Error in purchase order items GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/purchase-orders/[id]/items
 * Add an item to a purchase order
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

    // Verify PO exists and get status
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('id, status, supplier_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (poError || !po) {
      return NextResponse.json(
        { error: 'Beszerzési rendelés nem található' },
        { status: 404 }
      )
    }

    // Cannot add items if status is 'approved' or 'received'
    if (po.status === 'approved' || po.status === 'received') {
      return NextResponse.json(
        { error: 'A jóváhagyott vagy bevételezett rendeléshez nem adhat hozzá új tételeket' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      product_id,
      product_supplier_id,
      quantity,
      unit_cost,
      vat_id,
      currency_id,
      unit_id,
      description,
      shelf_location,
      note
    } = body

    // Validation
    if (!product_id || !quantity || !unit_cost || !vat_id || !unit_id) {
      return NextResponse.json(
        { error: 'Termék, mennyiség, egységár, ÁFA és mértékegység kötelező' },
        { status: 400 }
      )
    }

    if (parseFloat(quantity) <= 0) {
      return NextResponse.json(
        { error: 'A mennyiségnek pozitívnak kell lennie' },
        { status: 400 }
      )
    }

    if (parseFloat(unit_cost) < 0) {
      return NextResponse.json(
        { error: 'Az egységár nem lehet negatív' },
        { status: 400 }
      )
    }

    // Validate product exists
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select('id')
      .eq('id', product_id)
      .is('deleted_at', null)
      .single()

    if (productError || !product) {
      return NextResponse.json(
        { error: 'Termék nem található' },
        { status: 404 }
      )
    }

    // If product_supplier_id provided, validate it's connected to this supplier
    if (product_supplier_id) {
      const { data: productSupplier, error: psError } = await supabase
        .from('product_suppliers')
        .select('id, supplier_id, product_id')
        .eq('id', product_supplier_id)
        .is('deleted_at', null)
        .single()

      if (psError || !productSupplier) {
        return NextResponse.json(
          { error: 'Termék-beszállító kapcsolat nem található' },
          { status: 404 }
        )
      }

      if (productSupplier.supplier_id !== po.supplier_id) {
        return NextResponse.json(
          { error: 'A termék-beszállító kapcsolat nem egyezik a rendelés beszállítójával' },
          { status: 400 }
        )
      }

      if (productSupplier.product_id !== product_id) {
        return NextResponse.json(
          { error: 'A termék-beszállító kapcsolat nem egyezik a kiválasztott termékkel' },
          { status: 400 }
        )
      }
    } else {
      // If no product_supplier_id, check if product is connected to supplier
      const { data: productSupplierCheck } = await supabase
        .from('product_suppliers')
        .select('id')
        .eq('supplier_id', po.supplier_id)
        .eq('product_id', product_id)
        .is('deleted_at', null)
        .maybeSingle()

      if (!productSupplierCheck) {
        return NextResponse.json(
          { error: 'A termék nincs kapcsolva ehhez a beszállítóhoz. Kérjük, először kapcsolja össze a terméket a beszállítóval.' },
          { status: 400 }
        )
      }
    }

    // Get VAT rate for calculation
    const { data: vatRate } = await supabase
      .from('vat')
      .select('kulcs')
      .eq('id', vat_id)
      .is('deleted_at', null)
      .single()

    const vatPercent = vatRate?.kulcs || 0

    // Get PO currency if not provided
    const finalCurrencyId = currency_id || po.currency_id

    // Create item
    const { data: newItem, error: insertError } = await supabase
      .from('purchase_order_items')
      .insert({
        purchase_order_id: id,
        product_id,
        product_supplier_id: product_supplier_id || null,
        quantity: parseFloat(quantity),
        unit_cost: parseFloat(unit_cost),
        vat_id,
        currency_id: finalCurrencyId,
        unit_id,
        description: description?.trim() || null,
        shelf_location: shelf_location?.trim() || null,
        note: note?.trim() || null
      })
      .select(`
        *,
        products:product_id(id, name, sku),
        vat:vat_id(id, name, kulcs),
        units:unit_id(id, name, shortform)
      `)
      .single()

    if (insertError) {
      console.error('Error creating purchase order item:', insertError)
      return NextResponse.json(
        { error: insertError.message || 'Hiba a rendelési tétel létrehozásakor' },
        { status: 500 }
      )
    }

    // Recalculate PO totals
    await recalculatePOTotals(supabase, id)

    return NextResponse.json({ item: newItem }, { status: 201 })
  } catch (error) {
    console.error('Error in purchase order items POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Helper function to recalculate PO totals
 */
async function recalculatePOTotals(supabase: any, poId: string) {
  // Get all active items
  const { data: items } = await supabase
    .from('purchase_order_items')
    .select('quantity, unit_cost, vat_id, received_quantity')
    .eq('purchase_order_id', poId)
    .is('deleted_at', null)

  if (!items || items.length === 0) {
    // No items, reset totals
    await supabase
      .from('purchase_orders')
      .update({
        total_net: 0,
        total_vat: 0,
        total_gross: 0,
        total_weight: 0,
        item_count: 0,
        total_quantity: 0
      })
      .eq('id', poId)
    return
  }

  // Get VAT rates
  const { data: vatRates } = await supabase
    .from('vat')
    .select('id, kulcs')
    .is('deleted_at', null)

  const vatMap = new Map(vatRates?.map((v: any) => [v.id, v.kulcs || 0]) || [])

  // Calculate totals
  let totalNet = 0
  let totalVat = 0
  let totalGross = 0
  let totalQuantity = 0
  const itemCount = items.length

  for (const item of items) {
    const quantity = parseFloat(item.quantity) || 0
    const unitCost = parseFloat(item.unit_cost) || 0
    const vatRate = vatMap.get(item.vat_id) || 0

    const lineNet = Math.round(unitCost * quantity)
    const lineVat = Math.round(lineNet * vatRate / 100)
    const lineGross = lineNet + lineVat

    totalNet += lineNet
    totalVat += lineVat
    totalGross += lineGross
    totalQuantity += quantity
  }

  // Update PO totals
  await supabase
    .from('purchase_orders')
    .update({
      total_net: totalNet,
      total_vat: totalVat,
      total_gross: totalGross,
      total_weight: 0, // Would need product weight data
      item_count: itemCount,
      total_quantity: totalQuantity
    })
    .eq('id', poId)
}
