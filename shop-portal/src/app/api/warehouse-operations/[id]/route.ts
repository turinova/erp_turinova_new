import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/warehouse-operations/[id]
 * Get a single warehouse operation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch warehouse operation
    const { data: warehouseOp, error } = await supabase
      .from('warehouse_operations')
      .select(`
        *,
        shipments:shipment_id(id, shipment_number, status),
        warehouses:warehouse_id(id, name, code),
        created_by_user:created_by(id, email, full_name),
        completed_by_user:completed_by(id, email, full_name)
      `)
      .eq('id', id)
      .single()

    if (error || !warehouseOp) {
      return NextResponse.json(
        { error: 'Raktári művelet nem található' },
        { status: 404 }
      )
    }

    return NextResponse.json({ warehouse_operation: warehouseOp })
  } catch (error) {
    console.error('Error in warehouse operations GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
