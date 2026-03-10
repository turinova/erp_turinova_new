import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/stock/movements
 * Get stock movement history (immutable audit trail)
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
    const movement_type = searchParams.get('movement_type')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('stock_movements')
      .select(`
        *,
        warehouses:warehouse_id(id, name),
        products:product_id(id, name, sku),
        created_by_user:created_by(id, email, full_name),
        warehouse_operations:warehouse_operation_id(id, operation_number, operation_type)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    // Apply filters
    if (warehouse_id) {
      query = query.eq('warehouse_id', warehouse_id)
    }
    if (product_id) {
      query = query.eq('product_id', product_id)
    }
    if (movement_type && movement_type !== 'all') {
      query = query.eq('movement_type', movement_type)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching stock movements:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a készletmozgások lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      movements: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Error in stock movements GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
