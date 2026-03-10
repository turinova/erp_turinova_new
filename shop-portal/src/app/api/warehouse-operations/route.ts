import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/warehouse-operations
 * List warehouse operations with filtering
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
    const status = searchParams.get('status')
    const operation_type = searchParams.get('operation_type')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('warehouse_operations')
      .select(`
        id,
        operation_number,
        operation_type,
        status,
        shipment_id,
        shipments:shipment_id(id, shipment_number),
        warehouse_id,
        warehouses:warehouse_id(id, name),
        started_at,
        completed_at,
        created_by,
        created_by_user:created_by(id, email, full_name),
        completed_by,
        completed_by_user:completed_by(id, email, full_name),
        note,
        created_at,
        updated_at
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    // Apply filters
    if (warehouse_id) {
      query = query.eq('warehouse_id', warehouse_id)
    }
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    if (operation_type && operation_type !== 'all') {
      query = query.eq('operation_type', operation_type)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching warehouse operations:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a raktári műveletek lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      warehouse_operations: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Error in warehouse operations GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
