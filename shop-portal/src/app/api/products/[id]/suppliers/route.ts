import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/products/[id]/suppliers
 * Fetch all suppliers for a product
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch product-supplier relationships
    const { data: productSuppliers, error } = await supabase
      .from('product_suppliers')
      .select(`
        id,
        supplier_id,
        supplier_sku,
        supplier_barcode,
        default_cost,
        last_purchased_at,
        min_order_quantity,
        lead_time_days,
        is_preferred,
        is_active,
        created_at,
        updated_at,
        suppliers:supplier_id(id, name, email, phone, status)
      `)
      .eq('product_id', productId)
      .is('deleted_at', null)
      .order('is_preferred', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching product suppliers:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a beszállítók lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      product_suppliers: productSuppliers || []
    })
  } catch (error) {
    console.error('Error in product suppliers GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/products/[id]/suppliers
 * Add a new supplier to a product
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      supplier_id,
      supplier_sku,
      supplier_barcode,
      default_cost,
      min_order_quantity,
      lead_time_days,
      is_preferred,
      is_active = true
    } = body

    // Validation
    if (!supplier_id) {
      return NextResponse.json(
        { error: 'Beszállító kötelező' },
        { status: 400 }
      )
    }

    // Check if relationship already exists
    const { data: existing } = await supabase
      .from('product_suppliers')
      .select('id')
      .eq('product_id', productId)
      .eq('supplier_id', supplier_id)
      .is('deleted_at', null)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Ez a beszállító már hozzá van rendelve ehhez a termékhez' },
        { status: 400 }
      )
    }

    // If setting as preferred, unset other preferred suppliers for this product
    if (is_preferred) {
      await supabase
        .from('product_suppliers')
        .update({ is_preferred: false })
        .eq('product_id', productId)
        .is('deleted_at', null)
    }

    // Insert new relationship
    const { data: productSupplier, error } = await supabase
      .from('product_suppliers')
      .insert({
        product_id: productId,
        supplier_id,
        supplier_sku: supplier_sku || null,
        supplier_barcode: supplier_barcode || null,
        default_cost: default_cost ? parseFloat(default_cost) : null,
        min_order_quantity: min_order_quantity || 1,
        lead_time_days: lead_time_days || null,
        is_preferred: is_preferred || false,
        is_active: is_active !== undefined ? is_active : true
      })
      .select(`
        id,
        supplier_id,
        supplier_sku,
        supplier_barcode,
        default_cost,
        last_purchased_at,
        min_order_quantity,
        lead_time_days,
        is_preferred,
        is_active,
        created_at,
        updated_at,
        suppliers:supplier_id(id, name, email, phone, status)
      `)
      .single()

    if (error) {
      console.error('Error creating product supplier:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a beszállító hozzáadásakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      product_supplier: productSupplier
    }, { status: 201 })
  } catch (error) {
    console.error('Error in product suppliers POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
