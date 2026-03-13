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

    // Fetch stock movements for this warehouse operation
    const { data: stockMovements, error: movementsError } = await supabase
      .from('stock_movements')
      .select(`
        *,
        products:product_id(id, name, sku),
        warehouses:warehouse_id(id, name),
        created_by_user:created_by(id, email, full_name)
      `)
      .eq('warehouse_operation_id', id)
      .order('created_at', { ascending: false })

    if (movementsError) {
      console.error('Error fetching stock movements:', movementsError)
    }

    // Fetch units separately for products
    const movements = stockMovements || []
    if (movements.length > 0) {
      const productIds = movements
        .map((m: any) => m.product_id)
        .filter(Boolean)
      
      if (productIds.length > 0) {
        const { data: productsWithUnits } = await supabase
          .from('shoprenter_products')
          .select('id, unit_id')
          .in('id', productIds)

        const unitIds = (productsWithUnits || [])
          .map((p: any) => p.unit_id)
          .filter(Boolean)

        let unitsMap = new Map()
        if (unitIds.length > 0) {
          const { data: units } = await supabase
            .from('units')
            .select('id, name, shortform')
            .in('id', unitIds)

          unitsMap = new Map((units || []).map((u: any) => [u.id, u]))
        }

        // Map units to movements
        const productUnitMap = new Map(
          (productsWithUnits || []).map((p: any) => [p.id, p.unit_id])
        )

        movements.forEach((movement: any) => {
          if (movement.product_id) {
            const unitId = productUnitMap.get(movement.product_id)
            movement.products = {
              ...movement.products,
              unit: unitId ? unitsMap.get(unitId) || null : null
            }
          }
        })
      }
    }

    if (movementsError) {
      console.error('Error fetching stock movements:', movementsError)
    }

    // Calculate summary
    // Note: quantity can be positive (for 'in') or negative (for 'out')
    const summary = {
      total_items: movements.length,
      total_in: movements
        .filter((m: any) => m.movement_type === 'in' || m.movement_type === 'transfer_in')
        .reduce((sum: number, m: any) => {
          const qty = parseFloat(m.quantity || 0)
          return sum + Math.abs(qty) // Always use absolute value for 'in' movements
        }, 0),
      total_out: movements
        .filter((m: any) => m.movement_type === 'out' || m.movement_type === 'transfer_out')
        .reduce((sum: number, m: any) => {
          const qty = parseFloat(m.quantity || 0)
          return sum + Math.abs(qty) // Always use absolute value for 'out' movements
        }, 0),
      total_net: movements
        .filter((m: any) => m.unit_cost && m.unit_cost > 0)
        .reduce((sum: number, m: any) => {
          const qty = parseFloat(m.quantity || 0)
          const cost = parseFloat(m.unit_cost || 0)
          // Use absolute quantity * cost for all movements
          return sum + (Math.abs(qty) * cost)
        }, 0),
      total_vat: 0, // Will be calculated if VAT data is available
      total_gross: 0 // Will be calculated if VAT data is available
    }

    return NextResponse.json({
      warehouse_operation: warehouseOp,
      stock_movements: movements,
      summary
    })
  } catch (error) {
    console.error('Error in warehouse operations GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
