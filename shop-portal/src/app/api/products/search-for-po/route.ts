import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/products/search-for-po?q=XXX&limit=YYY
 * Search products for purchase order creation
 * Returns products with their supplier information
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('q')?.trim() || ''
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!search || search.length < 2) {
      return NextResponse.json({
        products: [],
        count: 0
      })
    }

    // Search products by name or SKU (include unit_id)
    let productsQuery = supabase
      .from('shoprenter_products')
      .select(`
        id,
        name,
        sku,
        model_number,
        gtin,
        internal_barcode,
        cost,
        price,
        vat_id,
        unit_id
      `)
      .is('deleted_at', null)
      .or(`name.ilike.%${search}%,sku.ilike.%${search}%`)
      .limit(limit)

    const { data: products, error: productsError } = await productsQuery

    if (productsError) {
      console.error('Error searching products:', productsError)
      return NextResponse.json(
        { error: productsError.message || 'Hiba a termékek keresésekor' },
        { status: 500 }
      )
    }

    if (!products || products.length === 0) {
      return NextResponse.json({
        products: [],
        count: 0
      })
    }

    const productIds = products.map(p => p.id)

    // Fetch all suppliers for these products
    const { data: productSuppliers, error: psError } = await supabase
      .from('product_suppliers')
      .select(`
        id,
        product_id,
        supplier_id,
        supplier_sku,
        supplier_barcode,
        default_cost,
        min_order_quantity,
        lead_time_days,
        is_preferred,
        is_active,
        suppliers:supplier_id(id, name)
      `)
      .in('product_id', productIds)
      .eq('is_active', true)
      .is('deleted_at', null)

    if (psError) {
      console.error('Error fetching product suppliers:', psError)
      // Continue without supplier info
    }

    // Group suppliers by product_id
    const suppliersByProduct = new Map<string, any[]>()
    if (productSuppliers) {
      productSuppliers.forEach((ps: any) => {
        const productId = ps.product_id
        if (!suppliersByProduct.has(productId)) {
          suppliersByProduct.set(productId, [])
        }
        const supplier = ps.suppliers
        suppliersByProduct.get(productId)!.push({
          supplier_id: ps.supplier_id,
          supplier_name: supplier?.name || 'Ismeretlen',
          product_supplier_id: ps.id,
          supplier_sku: ps.supplier_sku,
          supplier_barcode: ps.supplier_barcode,
          default_cost: ps.default_cost,
          min_order_quantity: ps.min_order_quantity || 1,
          lead_time_days: ps.lead_time_days,
          is_preferred: ps.is_preferred
        })
      })
    }

    // Fetch VAT rates
    const vatIds = [...new Set(products.map((p: any) => p.vat_id).filter(Boolean))]
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

    // Fetch all units for mapping unit_id to unit details
    const { data: allUnits } = await supabase
      .from('units')
      .select('id, name, shortform')
      .is('deleted_at', null)
    
    // Create a map of unit_id -> unit for quick lookup
    const unitsMapById = new Map()
    if (allUnits) {
      allUnits.forEach((u: any) => {
        unitsMapById.set(u.id, u)
      })
    }

    // Get default 'db' unit for fallback
    const defaultUnit = allUnits?.find((u: any) => u.shortform === 'db') || null
    
    // Transform products with supplier info
    const productsWithSuppliers = products.map((p: any) => {
      const suppliers = suppliersByProduct.get(p.id) || []
      
      // Use unit_id directly from product (source of truth)
      let matchedUnit = null
      if (p.unit_id) {
        matchedUnit = unitsMapById.get(p.unit_id)
      }
      
      // If no unit found, use default 'db' (Darab)
      if (!matchedUnit) {
        matchedUnit = defaultUnit
      }

      return {
        product_id: p.id,
        product_name: p.name,
        product_sku: p.sku,
        model_number: p.model_number, // Used as supplier SKU fallback
        gtin: p.gtin,
        internal_barcode: p.internal_barcode,
        cost: p.cost,
        price: p.price,
        vat_id: p.vat_id,
        vat_rate: p.vat_id ? (vatMap.get(p.vat_id)?.kulcs || 0) : 0,
        unit_id: matchedUnit?.id || null,
        unit_name: matchedUnit?.name || null,
        unit_shortform: matchedUnit?.shortform || 'db',
        suppliers: suppliers,
        supplier_count: suppliers.length,
        has_suppliers: suppliers.length > 0
      }
    })

    return NextResponse.json({
      products: productsWithSuppliers,
      count: productsWithSuppliers.length
    })
  } catch (error) {
    console.error('Error in product search for PO:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
