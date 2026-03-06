import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getAllProducts } from '@/lib/products-server'

/**
 * GET /api/products/search?q=XXX&page=YYY&limit=ZZZ
 * General product search (for products page)
 * 
 * GET /api/products/search?connection_id=XXX&search=YYY&limit=ZZZ
 * Search products by connection (for autocomplete/selection in wizard)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connection_id')
    const search = searchParams.get('search') || searchParams.get('q') || ''
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // If connection_id is provided, this is for wizard autocomplete
    if (connectionId) {
      // Build query for specific connection
      let query = supabase
        .from('shoprenter_products')
        .select('id, sku, name, model_number', { count: 'exact' })
        .eq('connection_id', connectionId)
        .is('deleted_at', null)

      // Apply search filter
      if (search && search.trim().length > 0) {
        const searchTerm = search.trim()
        query = query.or(`sku.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%,model_number.ilike.%${searchTerm}%`)
      }

      // Get results
      const { data: products, count, error } = await query
        .order('sku', { ascending: true })
        .limit(limit)

      if (error) {
        console.error('Error searching products:', error)
        return NextResponse.json(
          { error: 'Hiba a termékek keresésekor' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        products: products || [],
        totalCount: count || 0
      })
    } else {
      // General search for products page (uses getAllProducts)
      const result = await getAllProducts(page, limit, search)
      return NextResponse.json(result)
    }
  } catch (error) {
    console.error('Error in products search:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
