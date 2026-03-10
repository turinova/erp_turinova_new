import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/purchase-orders
 * List all purchase orders with pagination, search, and filtering
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const status = searchParams.get('status') // optional filter
    const search = searchParams.get('search')?.trim() // optional search by PO number or supplier name

    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('purchase_orders')
      .select(`
        id,
        po_number,
        status,
        supplier_id,
        suppliers:supplier_id(id, name),
        warehouse_id,
        warehouses:warehouse_id(id, name),
        order_date,
        expected_delivery_date,
        total_net,
        total_vat,
        total_gross,
        total_weight,
        item_count,
        total_quantity,
        email_sent,
        email_sent_at,
        created_at,
        updated_at
      `, { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    // Apply status filter
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // Apply search filter (PO number or supplier name)
    if (search) {
      query = query.or(`po_number.ilike.%${search}%,suppliers.name.ilike.%${search}%`)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching purchase orders:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a beszerzési rendelések lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      purchase_orders: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Error in purchase orders GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/purchase-orders
 * Create a new purchase order
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      supplier_id,
      warehouse_id,
      order_date,
      expected_delivery_date,
      currency_id,
      note,
      items = []
    } = body

    // Validation
    if (!supplier_id || !warehouse_id) {
      return NextResponse.json(
        { error: 'Beszállító és raktár kötelező' },
        { status: 400 }
      )
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Legalább egy termék kötelező' },
        { status: 400 }
      )
    }

    // Validate supplier exists
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('id')
      .eq('id', supplier_id)
      .is('deleted_at', null)
      .single()

    if (supplierError || !supplier) {
      return NextResponse.json(
        { error: 'Beszállító nem található' },
        { status: 404 }
      )
    }

    // Validate warehouse exists
    const { data: warehouse, error: warehouseError } = await supabase
      .from('warehouses')
      .select('id')
      .eq('id', warehouse_id)
      .single()

    if (warehouseError || !warehouse) {
      return NextResponse.json(
        { error: 'Raktár nem található' },
        { status: 404 }
      )
    }

    // Get VAT rates for calculations
    const { data: vatRates } = await supabase
      .from('vat')
      .select('id, kulcs')
      .is('deleted_at', null)

    const vatMap = new Map(vatRates?.map(v => [v.id, v.kulcs || 0]) || [])

    // Calculate totals from items
    let totalNet = 0
    let totalVat = 0
    let totalGross = 0
    let totalWeight = 0
    let totalQuantity = 0
    const itemCount = items.length

    for (const item of items) {
      const quantity = parseFloat(item.quantity) || 0
      const unitCost = parseFloat(item.unit_cost) || 0
      const vatRate = vatMap.get(item.vat_id) || 0

      // Calculate line totals (following Hungarian rounding pattern)
      const lineNet = Math.round(unitCost * quantity)
      const lineVat = Math.round(lineNet * vatRate / 100)
      const lineGross = lineNet + lineVat

      totalNet += lineNet
      totalVat += lineVat
      totalGross += lineGross

      // Physical totals
      totalQuantity += quantity
      // Weight calculation would need product data - skip for now
    }

    // Create purchase order
    const { data: purchaseOrder, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        supplier_id,
        warehouse_id,
        order_date: order_date || new Date().toISOString().split('T')[0],
        expected_delivery_date: expected_delivery_date || null,
        currency_id: currency_id || null,
        note: note?.trim() || null,
        status: 'draft',
        total_net: totalNet,
        total_vat: totalVat,
        total_gross: totalGross,
        total_weight: totalWeight,
        item_count: itemCount,
        total_quantity: totalQuantity
      })
      .select()
      .single()

    if (poError) {
      console.error('Error creating purchase order:', poError)
      return NextResponse.json(
        { error: poError.message || 'Hiba a beszerzési rendelés létrehozásakor' },
        { status: 500 }
      )
    }

    // Create purchase order items
    const itemsToInsert = items.map((item: any) => ({
      purchase_order_id: purchaseOrder.id,
      product_id: item.product_id,
      product_supplier_id: item.product_supplier_id || null,
      quantity: parseFloat(item.quantity) || 0,
      unit_cost: parseFloat(item.unit_cost) || 0,
      vat_id: item.vat_id,
      currency_id: item.currency_id || currency_id || null,
      unit_id: item.unit_id,
      description: item.description?.trim() || null,
      shelf_location: item.shelf_location?.trim() || null,
      note: item.note?.trim() || null
    }))

    const { data: createdItems, error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(itemsToInsert)
      .select()

    if (itemsError) {
      console.error('Error creating purchase order items:', itemsError)
      // Rollback: delete the PO
      await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', purchaseOrder.id)

      return NextResponse.json(
        { error: itemsError.message || 'Hiba a rendelési tételek létrehozásakor' },
        { status: 500 }
      )
    }

    // Fetch complete PO with relationships
    const { data: completePO, error: fetchError } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        suppliers:supplier_id(id, name),
        warehouses:warehouse_id(id, name),
        currencies:currency_id(id, name, code),
        purchase_order_items(*)
      `)
      .eq('id', purchaseOrder.id)
      .single()

    if (fetchError) {
      console.error('Error fetching complete purchase order:', fetchError)
    }

    return NextResponse.json(
      { purchase_order: completePO || purchaseOrder },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in purchase orders POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
