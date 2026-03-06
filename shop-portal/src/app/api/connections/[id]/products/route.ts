import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/connections/[id]/products
 * Fetch products for a connection (for parent product selection, etc.)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: connectionId } = await params
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const url = new URL(request.url)
    const excludeProductId = url.searchParams.get('excludeProductId')
    const search = url.searchParams.get('search') || ''
    const limit = parseInt(url.searchParams.get('limit') || '50')

    // Build query
    let query = supabase
      .from('shoprenter_products')
      .select(`
        id,
        name,
        sku,
        shoprenter_id,
        parent_product_id,
        shoprenter_product_descriptions(name)
      `)
      .eq('connection_id', connectionId)
      .is('deleted_at', null)
      .is('parent_product_id', null) // Filter out products that already have a parent (children can't be parents)
      .order('name', { ascending: true })
      .limit(limit)

    // Exclude specific product if provided
    if (excludeProductId) {
      query = query.neq('id', excludeProductId)
    }

    // Apply search filter if provided
    if (search.trim()) {
      // Search in name, sku, or model_number
      // Use proper ILIKE syntax for Supabase
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,model_number.ilike.%${search}%`)
    }

    const { data: products, error } = await query

    if (error) {
      console.error('[API] Error fetching products:', error)
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }

    // Format products with display names
    const formattedProducts = (products || []).map(product => ({
      id: product.id,
      name: product.shoprenter_product_descriptions?.[0]?.name || product.name || product.sku,
      sku: product.sku,
      shoprenter_id: product.shoprenter_id
    }))

    return NextResponse.json({ 
      success: true,
      products: formattedProducts 
    })
  } catch (error) {
    console.error('[API] Error in products route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
