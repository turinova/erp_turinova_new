import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/stock
 * Get stock summary (from stock_summary view)
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
    const warehouse_id = searchParams.get('warehouse_id')
    const product_id = searchParams.get('product_id')
    const search = searchParams.get('search')?.trim() // Search by product name or SKU
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const offset = (page - 1) * limit

    // Refresh stock summary view first
    await supabase.rpc('refresh_stock_summary').catch(() => {
      // If function doesn't exist, that's okay
    })

    // Build query
    let query = supabase
      .from('stock_summary')
      .select('*', { count: 'exact' })
      .order('product_name', { ascending: true })

    // Apply filters
    if (warehouse_id) {
      query = query.eq('warehouse_id', warehouse_id)
    }
    if (product_id) {
      query = query.eq('product_id', product_id)
    }
    if (search) {
      query = query.or(`product_name.ilike.%${search}%,sku.ilike.%${search}%`)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching stock summary:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a készlet lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      stock: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Error in stock GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
