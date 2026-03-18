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
    const status = searchParams.get('status')
    const search = searchParams.get('search')?.trim()
    const rawSupplierId = searchParams.get('supplier_id')?.trim()
    const supplier_id = rawSupplierId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawSupplierId) ? rawSupplierId : null

    const offset = (page - 1) * limit

    const selectColumns = `
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
    `

    let data: any[] = []
    let count: number | null = 0

    if (search) {
      // Resolve PO ids from text match (po_number, supplier name) and product match (product name/sku)
      // PostgREST requires the relation in select to filter by suppliers.name
      let textMatchQuery = supabase
        .from('purchase_orders')
        .select('id,suppliers:supplier_id(name)')
        .is('deleted_at', null)
        .or(`po_number.ilike.%${search}%,suppliers.name.ilike.%${search}%`)
      if (status && status !== 'all') textMatchQuery = textMatchQuery.eq('status', status)
      if (supplier_id) textMatchQuery = textMatchQuery.eq('supplier_id', supplier_id)
      const { data: textIds } = await textMatchQuery

      let productPoIds: string[] = []
      const { data: products } = await supabase
        .from('shoprenter_products')
        .select('id')
        .or(`name.ilike.%${search}%,sku.ilike.%${search}%`)
        .is('deleted_at', null)
        .limit(5000)
      if (products && products.length > 0) {
        const productIds = products.map((p: { id: string }) => p.id)
        const { data: poi } = await supabase
          .from('purchase_order_items')
          .select('purchase_order_id')
          .in('product_id', productIds)
          .is('deleted_at', null)
        if (poi) productPoIds = [...new Set(poi.map((r: { purchase_order_id: string }) => r.purchase_order_id))]
      }

      const mergedIds = [...new Set([...(textIds || []).map((r: { id: string }) => r.id), ...productPoIds])]
      if (mergedIds.length === 0) {
        return NextResponse.json({
          purchase_orders: [],
          pagination: { page, limit, total: 0, totalPages: 0 }
        })
      }

      let listQuery = supabase
        .from('purchase_orders')
        .select(selectColumns, { count: 'exact' })
        .is('deleted_at', null)
        .in('id', mergedIds)
        .order('created_at', { ascending: false })
      if (status && status !== 'all') listQuery = listQuery.eq('status', status)
      if (supplier_id) listQuery = listQuery.eq('supplier_id', supplier_id)
      listQuery = listQuery.range(offset, offset + limit - 1)
      const res = await listQuery
      if (res.error) {
        console.error('Error fetching purchase orders:', res.error)
        return NextResponse.json(
          { error: res.error.message || 'Hiba a beszerzési rendelések lekérdezésekor' },
          { status: 500 }
        )
      }
      data = res.data || []
      count = res.count
    } else {
      let query = supabase
        .from('purchase_orders')
        .select(selectColumns, { count: 'exact' })
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (status && status !== 'all') query = query.eq('status', status)
      if (supplier_id) query = query.eq('supplier_id', supplier_id)
      query = query.range(offset, offset + limit - 1)
      const res = await query
      if (res.error) {
        console.error('Error fetching purchase orders:', res.error)
        return NextResponse.json(
          { error: res.error.message || 'Hiba a beszerzési rendelések lekérdezésekor' },
          { status: 500 }
        )
      }
      data = res.data || []
      count = res.count
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

    // Resolve product_supplier_id for each item: use provided if it belongs to PO supplier, else find-or-create link for (product_id, supplier_id)
    const itemsWithResolvedSupplier: Array<{ product_supplier_id: string | null; item: any }> = []
    for (const item of items) {
      let productSupplierId: string | null = item.product_supplier_id || null
      if (productSupplierId) {
        const { data: ps } = await supabase
          .from('product_suppliers')
          .select('id')
          .eq('id', productSupplierId)
          .eq('supplier_id', supplier_id)
          .is('deleted_at', null)
          .single()
        if (!ps) productSupplierId = null
      }
      if (!productSupplierId && item.product_id) {
        const { data: existing } = await supabase
          .from('product_suppliers')
          .select('id')
          .eq('product_id', item.product_id)
          .eq('supplier_id', supplier_id)
          .is('deleted_at', null)
          .limit(1)
          .maybeSingle()
        if (existing) {
          productSupplierId = existing.id
        } else {
          const defaultCost = item.unit_cost != null && item.unit_cost !== '' ? parseFloat(item.unit_cost) : null
          const { data: created } = await supabase
            .from('product_suppliers')
            .insert({
              product_id: item.product_id,
              supplier_id,
              default_cost: defaultCost,
              is_active: true
            })
            .select('id')
            .single()
          if (created) productSupplierId = created.id
        }
      }
      itemsWithResolvedSupplier.push({ product_supplier_id: productSupplierId, item })
    }

    // Create purchase order items
    const itemsToInsert = itemsWithResolvedSupplier.map(({ product_supplier_id: resolvedId, item }) => ({
      purchase_order_id: purchaseOrder.id,
      product_id: item.product_id,
      product_supplier_id: resolvedId,
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
