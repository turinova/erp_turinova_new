import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/shipments
 * List all shipments with pagination, search, and filtering
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
    const search = searchParams.get('search')?.trim() // optional search by shipment number or supplier name

    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('shipments')
      .select(`
        id,
        shipment_number,
        status,
        supplier_id,
        suppliers:supplier_id(id, name),
        warehouse_id,
        warehouses:warehouse_id(id, name, code),
        expected_arrival_date,
        actual_arrival_date,
        purchased_date,
        currency_id,
        currencies:currency_id(id, name, code),
        created_at,
        updated_at
      `, { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    // Apply status filter
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // Apply search filter (shipment number or supplier name)
    if (search) {
      query = query.or(`shipment_number.ilike.%${search}%,suppliers.name.ilike.%${search}%`)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching shipments:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a szállítmányok lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      shipments: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Error in shipments GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/shipments
 * Create a shipment from one or more approved purchase orders
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
      purchase_order_ids = [],
      expected_arrival_date,
      purchased_date,
      currency_id,
      note
    } = body

    // Validation
    if (!supplier_id || !warehouse_id) {
      return NextResponse.json(
        { error: 'Beszállító és raktár kötelező' },
        { status: 400 }
      )
    }

    if (!purchase_order_ids || purchase_order_ids.length === 0) {
      return NextResponse.json(
        { error: 'Legalább egy beszerzési rendelés kötelező' },
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

    // Validate all purchase orders exist, are approved, and have same supplier
    const { data: purchaseOrders, error: poError } = await supabase
      .from('purchase_orders')
      .select('id, status, supplier_id')
      .in('id', purchase_order_ids)
      .is('deleted_at', null)

    if (poError || !purchaseOrders || purchaseOrders.length !== purchase_order_ids.length) {
      return NextResponse.json(
        { error: 'Egy vagy több beszerzési rendelés nem található' },
        { status: 404 }
      )
    }

    // Check all POs are approved and have same supplier
    for (const po of purchaseOrders) {
      if (po.status !== 'approved') {
        return NextResponse.json(
          { error: `A beszerzési rendelés ${po.id} nincs jóváhagyva. Csak jóváhagyott rendelésekből hozható létre szállítmány.` },
          { status: 400 }
        )
      }
      if (po.supplier_id !== supplier_id) {
        return NextResponse.json(
          { error: 'Minden beszerzési rendelésnek ugyanazt a beszállítót kell tartalmaznia' },
          { status: 400 }
        )
      }
    }

    // Create shipment
    const { data: shipment, error: shipmentError } = await supabase
      .from('shipments')
      .insert({
        supplier_id,
        warehouse_id,
        expected_arrival_date: expected_arrival_date || null,
        purchased_date: purchased_date || null,
        currency_id: currency_id || null,
        note: note?.trim() || null,
        status: 'waiting'
      })
      .select()
      .single()

    if (shipmentError) {
      console.error('Error creating shipment:', shipmentError)
      return NextResponse.json(
        { error: shipmentError.message || 'Hiba a szállítmány létrehozásakor' },
        { status: 500 }
      )
    }

    // Link purchase orders to shipment
    const shipmentPOs = purchase_order_ids.map((poId: string) => ({
      shipment_id: shipment.id,
      purchase_order_id: poId
    }))

    const { error: linkError } = await supabase
      .from('shipment_purchase_orders')
      .insert(shipmentPOs)

    if (linkError) {
      console.error('Error linking purchase orders:', linkError)
      // Rollback: delete shipment
      await supabase
        .from('shipments')
        .delete()
        .eq('id', shipment.id)

      return NextResponse.json(
        { error: linkError.message || 'Hiba a beszerzési rendelések kapcsolásakor' },
        { status: 500 }
      )
    }

    // Create shipment items from PO items
    // Get all items from all linked POs
    const { data: poItems, error: itemsError } = await supabase
      .from('purchase_order_items')
      .select('id, product_id, quantity, unit_cost, vat_id, currency_id')
      .in('purchase_order_id', purchase_order_ids)
      .is('deleted_at', null)

    if (itemsError) {
      console.error('Error fetching PO items:', itemsError)
      // Rollback: delete shipment and links
      await supabase
        .from('shipment_purchase_orders')
        .delete()
        .eq('shipment_id', shipment.id)
      await supabase
        .from('shipments')
        .delete()
        .eq('id', shipment.id)

      return NextResponse.json(
        { error: 'Hiba a rendelési tételek lekérdezésekor' },
        { status: 500 }
      )
    }

    // Create shipment items
    if (poItems && poItems.length > 0) {
      const shipmentItems = poItems.map((item: any) => ({
        shipment_id: shipment.id,
        purchase_order_item_id: item.id,
        product_id: item.product_id,
        expected_quantity: item.quantity,
        received_quantity: 0,
        unit_cost: item.unit_cost,
        vat_id: item.vat_id,
        currency_id: item.currency_id || currency_id,
        is_unexpected: false
      }))

      const { error: itemsInsertError } = await supabase
        .from('shipment_items')
        .insert(shipmentItems)

      if (itemsInsertError) {
        console.error('Error creating shipment items:', itemsInsertError)
        // Rollback: delete shipment, links, and items
        await supabase
          .from('shipment_items')
          .delete()
          .eq('shipment_id', shipment.id)
        await supabase
          .from('shipment_purchase_orders')
          .delete()
          .eq('shipment_id', shipment.id)
        await supabase
          .from('shipments')
          .delete()
          .eq('id', shipment.id)

        return NextResponse.json(
          { error: itemsInsertError.message || 'Hiba a szállítmány tételek létrehozásakor' },
          { status: 500 }
        )
      }
    }

    // Create warehouse operation
    const { data: warehouseOp, error: woError } = await supabase
      .from('warehouse_operations')
      .insert({
        shipment_id: shipment.id,
        warehouse_id,
        operation_type: 'receiving',
        status: 'waiting',
        created_by: user.id
      })
      .select()
      .single()

    if (woError) {
      console.error('Error creating warehouse operation:', woError)
      // Don't rollback shipment, just log the error
      // Warehouse operation is not critical for shipment creation
    }

    // Fetch complete shipment with relationships
    const { data: completeShipment, error: fetchError } = await supabase
      .from('shipments')
      .select(`
        *,
        suppliers:supplier_id(id, name),
        warehouses:warehouse_id(id, name, code),
        currencies:currency_id(id, name, code),
        shipment_purchase_orders(
          purchase_orders:purchase_order_id(id, po_number, status)
        )
      `)
      .eq('id', shipment.id)
      .single()

    if (fetchError) {
      console.error('Error fetching complete shipment:', fetchError)
    }

    return NextResponse.json(
      { 
        shipment: completeShipment || shipment,
        warehouse_operation: warehouseOp || null
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in shipments POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
