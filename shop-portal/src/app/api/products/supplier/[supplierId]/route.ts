import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/products/supplier/[supplierId]
 * Get all products connected to a specific supplier (for PO item selection)
 * Supports search by product name or SKU
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ supplierId: string }> }
) {
  try {
    const { supplierId } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() // Optional search by product name or SKU
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    // Validate supplier exists
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('id', supplierId)
      .is('deleted_at', null)
      .single()

    if (supplierError || !supplier) {
      return NextResponse.json(
        { error: 'Beszállító nem található' },
        { status: 404 }
      )
    }

    // Build query for products connected to this supplier
    // Use a safer approach: fetch product_suppliers first, then fetch products separately
    let query = supabase
      .from('product_suppliers')
      .select(`
        id,
        product_id,
        supplier_sku,
        supplier_barcode,
        default_cost,
        last_purchased_at,
        min_order_quantity,
        lead_time_days,
        is_preferred,
        is_active
      `)
      .eq('supplier_id', supplierId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('is_preferred', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    const { data: productSuppliers, error: psError } = await query

    if (psError) {
      console.error('Error fetching product_suppliers:', psError)
      return NextResponse.json(
        { error: psError.message || 'Hiba a termék-beszállító kapcsolatok lekérdezésekor' },
        { status: 500 }
      )
    }

    if (!productSuppliers || productSuppliers.length === 0) {
      return NextResponse.json({
        supplier: {
          id: supplier.id,
          name: supplier.name
        },
        products: [],
        count: 0
      })
    }

    // Get all product IDs
    const productIds = productSuppliers.map((ps: any) => ps.product_id).filter(Boolean)

    if (productIds.length === 0) {
      return NextResponse.json({
        supplier: {
          id: supplier.id,
          name: supplier.name
        },
        products: [],
        count: 0
      })
    }

    // Fetch products with their related data
    let productsQuery = supabase
      .from('shoprenter_products')
      .select(`
        id,
        name,
        sku,
        gtin,
        internal_barcode,
        cost,
        price,
        vat_id,
        weight
      `)
      .in('id', productIds)
      .is('deleted_at', null)

    // Apply search filter if provided
    if (search) {
      productsQuery = productsQuery.or(`name.ilike.%${search}%,sku.ilike.%${search}%`)
    }

    const { data: products, error: productsError } = await productsQuery

    if (productsError) {
      console.error('Error fetching products:', productsError)
      return NextResponse.json(
        { error: productsError.message || 'Hiba a termékek lekérdezésekor' },
        { status: 500 }
      )
    }

    // Fetch product descriptions to get measurement_unit
    const { data: descriptions } = await supabase
      .from('shoprenter_product_descriptions')
      .select('product_id, measurement_unit')
      .in('product_id', productIds)
      .eq('language_code', 'hu')
      .is('deleted_at', null)

    // Create a map of product_id -> measurement_unit
    const measurementUnitMap = new Map()
    if (descriptions) {
      descriptions.forEach((d: any) => {
        if (d.measurement_unit) {
          measurementUnitMap.set(d.product_id, d.measurement_unit)
        }
      })
    }

    // Fetch VAT rates separately
    const vatIds = [...new Set((products || []).map((p: any) => p.vat_id).filter(Boolean))]

    let vatMap = new Map()

    if (vatIds.length > 0) {
      const { data: vats } = await supabase
        .from('vat')
        .select('id, name, kulcs')
        .in('id', vatIds)
        .is('deleted_at', null)
      
      if (vats) {
        vatMap = new Map(vats.map((v: any) => [v.id, v]))
      }
    }

    // Fetch all units to map measurement_unit text to unit_id
    const { data: allUnits } = await supabase
      .from('units')
      .select('id, name, shortform')
      .is('deleted_at', null)
    
    // Create a map of shortform -> unit for quick lookup
    const unitsMapByShortform = new Map()
    if (allUnits) {
      allUnits.forEach((u: any) => {
        unitsMapByShortform.set(u.shortform.toLowerCase(), u)
      })
    }

    // Create a map of product_id -> product for quick lookup
    const productsMap = new Map((products || []).map((p: any) => {
      const measurementUnitText = measurementUnitMap.get(p.id) || null
      
      // Try to find matching unit by shortform
      let matchedUnit = null
      if (measurementUnitText) {
        matchedUnit = unitsMapByShortform.get(measurementUnitText.toLowerCase())
      }
      
      return [p.id, {
        ...p,
        vat: p.vat_id ? vatMap.get(p.vat_id) : null,
        measurement_unit_text: measurementUnitText,
        unit_id: matchedUnit?.id || null,
        unit_name: matchedUnit?.name || null,
        unit_shortform: matchedUnit?.shortform || measurementUnitText
      }]
    }))

    // Transform data to be more user-friendly
    const transformedProducts = productSuppliers
      .map((ps: any) => {
        const product = productsMap.get(ps.product_id)
        if (!product) return null // Skip if product not found or deleted

        return {
          product_supplier_id: ps.id,
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          supplier_sku: ps.supplier_sku,
          supplier_barcode: ps.supplier_barcode,
          default_cost: ps.default_cost,
          last_purchased_at: ps.last_purchased_at,
          min_order_quantity: ps.min_order_quantity || 1,
          lead_time_days: ps.lead_time_days,
          is_preferred: ps.is_preferred,
          vat_id: product.vat_id,
          vat_rate: product.vat?.kulcs || 0,
          unit_id: product.unit_id,
          unit_name: product.unit_name,
          unit_shortform: product.unit_shortform
        }
      })
      .filter((p: any) => p !== null) // Filter out null entries

    // Apply search filter on supplier_sku if provided (since we already filtered products)
    let finalProducts = transformedProducts
    if (search) {
      const searchLower = search.toLowerCase()
      finalProducts = transformedProducts.filter((p: any) =>
        p.product_name?.toLowerCase().includes(searchLower) ||
        p.product_sku?.toLowerCase().includes(searchLower) ||
        p.supplier_sku?.toLowerCase().includes(searchLower)
      )
    }

    return NextResponse.json({
      supplier: {
        id: supplier.id,
        name: supplier.name
      },
      products: finalProducts,
      count: finalProducts.length
    })
  } catch (error) {
    console.error('Error in supplier products API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
