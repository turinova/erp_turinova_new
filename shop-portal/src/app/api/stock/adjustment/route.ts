import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * POST /api/stock/adjustment
 * Manual stock adjustment (creates stock movement and optionally warehouse operation)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      warehouse_id,
      product_id,
      quantity,
      unit_cost,
      shelf_location,
      note
    } = body

    // Validation
    if (!warehouse_id || !product_id || quantity === undefined || quantity === null) {
      return NextResponse.json(
        { error: 'Raktár, termék és mennyiség kötelező' },
        { status: 400 }
      )
    }

    const qty = parseFloat(quantity)
    if (qty === 0) {
      return NextResponse.json(
        { error: 'A mennyiség nem lehet 0' },
        { status: 400 }
      )
    }

    // Validate warehouse exists
    const { data: warehouse, error: warehouseError } = await supabase
      .from('warehouses')
      .select('id')
      .eq('id', warehouse_id)
      .single()

    if (warehouseError || !warehouse) {
      return NextResponse.json(
        { error: 'Raktár nem található' },
        { status: 404 }
      )
    }

    // Validate product exists
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select('id')
      .eq('id', product_id)
      .is('deleted_at', null)
      .single()

    if (productError || !product) {
      return NextResponse.json(
        { error: 'Termék nem található' },
        { status: 404 }
      )
    }

    // Determine movement type
    const movementType = qty > 0 ? 'adjustment' : 'adjustment'
    // Note: For negative adjustments, we still use 'adjustment' type but with negative quantity

    // Create warehouse operation (optional, for tracking)
    let warehouseOperationId = null
    if (note || shelf_location) {
      const { data: wo, error: woError } = await supabase
        .from('warehouse_operations')
        .insert({
          warehouse_id,
          operation_type: 'adjustment',
          status: 'completed',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          created_by: user.id,
          completed_by: user.id,
          note: note?.trim() || null
        })
        .select('id')
        .single()

      if (!woError && wo) {
        warehouseOperationId = wo.id
      }
    }

    // Create stock movement
    const { data: stockMovement, error: movementError } = await supabase
      .from('stock_movements')
      .insert({
        warehouse_id,
        product_id,
        movement_type: movementType,
        quantity: qty, // Can be negative for decreases
        unit_cost: unit_cost ? parseFloat(unit_cost) : null,
        shelf_location: shelf_location?.trim() || null,
        source_type: 'manual_adjustment',
        source_id: null,
        warehouse_operation_id: warehouseOperationId,
        note: note?.trim() || null,
        created_by: user.id
      })
      .select(`
        *,
        warehouses:warehouse_id(id, name),
        products:product_id(id, name, sku),
        created_by_user:created_by(id, email, full_name)
      `)
      .single()

    if (movementError) {
      console.error('Error creating stock movement:', movementError)
      // Rollback warehouse operation if created
      if (warehouseOperationId) {
        await supabase
          .from('warehouse_operations')
          .delete()
          .eq('id', warehouseOperationId)
      }
      return NextResponse.json(
        { error: movementError.message || 'Hiba a készletmozgás létrehozásakor' },
        { status: 500 }
      )
    }

    // Refresh stock summary view
    await supabase.rpc('refresh_stock_summary').catch(() => {
      // If function doesn't exist, that's okay
    })

    return NextResponse.json(
      { 
        stock_movement: stockMovement,
        warehouse_operation_id: warehouseOperationId
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in stock adjustment POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
