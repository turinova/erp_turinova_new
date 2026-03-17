import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/products/[id]/inventory
 * Get inventory data for a specific product across all warehouses
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

    // Refresh stock summary view first (optional, view might be stale)
    try {
      const { error: refreshError } = await supabase.rpc('refresh_stock_summary')
      if (refreshError) {
        // Function might not exist or view might not need refresh
        console.warn('Could not refresh stock_summary view:', refreshError.message)
      }
    } catch (error) {
      // If function doesn't exist, that's okay - we'll use the view as-is
      console.warn('refresh_stock_summary function not available, using view as-is')
    }

    // Get stock summary for this product (all warehouses)
    const { data: stockSummary, error: stockError } = await supabase
      .from('stock_summary')
      .select('*')
      .eq('product_id', id)

    if (stockError) {
      console.error('Error fetching stock summary:', stockError)
    }

    // Get all active warehouses
    const { data: warehouses, error: warehousesError } = await supabase
      .from('warehouses')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name')

    if (warehousesError) {
      console.error('Error fetching warehouses:', warehousesError)
    }

    // Calculate totals
    const summary = {
      total_on_hand: 0,
      total_available: 0,
      total_reserved: 0,
      total_value: 0,
      total_incoming: 0
    }

    const warehousesData = (warehouses || []).map((warehouse: any) => {
      const stock = (stockSummary || []).find((s: any) => s.warehouse_id === warehouse.id)
      
      const quantity_on_hand = stock ? parseFloat(stock.quantity_on_hand || 0) : 0
      const quantity_available = stock ? parseFloat(stock.quantity_available || 0) : 0
      const quantity_reserved = stock ? parseFloat(stock.quantity_reserved || 0) : 0
      const total_value = stock ? parseFloat(stock.total_value || 0) : 0

      // Add to totals
      summary.total_on_hand += quantity_on_hand
      summary.total_available += quantity_available
      summary.total_reserved += quantity_reserved
      summary.total_value += total_value

      return {
        warehouse_id: warehouse.id,
        warehouse_name: warehouse.name,
        warehouse_code: warehouse.code,
        quantity_on_hand: quantity_on_hand,
        quantity_available: quantity_available,
        quantity_reserved: quantity_reserved,
        average_cost: stock ? parseFloat(stock.average_cost || 0) : 0,
        total_value: total_value,
        last_movement_at: stock?.last_movement_at || null
      }
    })

    // Incoming from open POs (quantity not yet received)
    const OPEN_PO_STATUSES = ['draft', 'pending_approval', 'approved', 'partially_received']
    const { data: openPOs } = await supabase
      .from('purchase_orders')
      .select('id')
      .in('status', OPEN_PO_STATUSES)
      .is('deleted_at', null)
    if (openPOs && openPOs.length > 0) {
      const openPoIds = openPOs.map((p: any) => p.id)
      const { data: poItems } = await supabase
        .from('purchase_order_items')
        .select('quantity, received_quantity')
        .eq('product_id', id)
        .in('purchase_order_id', openPoIds)
        .is('deleted_at', null)
      if (poItems) {
        for (const row of poItems as any[]) {
          const qty = parseFloat(String(row.quantity)) || 0
          const received = parseFloat(String(row.received_quantity)) || 0
          summary.total_incoming += Math.max(0, qty - received)
        }
        summary.total_incoming = Math.round(summary.total_incoming * 100) / 100
      }
    }

    // Get incoming shipments (waiting shipments with this product)
    // First get shipment items
    const { data: shipmentItems, error: itemsError } = await supabase
      .from('shipment_items')
      .select('id, shipment_id, expected_quantity, received_quantity')
      .eq('product_id', id)
      .gt('expected_quantity', 0)

    // Then get shipments separately
    let incomingShipments: any[] = []
    if (shipmentItems && shipmentItems.length > 0) {
      const shipmentIds = [...new Set(shipmentItems.map((item: any) => item.shipment_id).filter(Boolean))]
      
      if (shipmentIds.length > 0) {
        const { data: shipments, error: shipmentsError } = await supabase
          .from('shipments')
          .select('id, shipment_number, status, expected_arrival_date, warehouse_id')
          .in('id', shipmentIds)
          .eq('status', 'waiting')

        if (!shipmentsError && shipments) {
          // Join shipment items with shipments
          incomingShipments = shipmentItems
            .map((item: any) => {
              const shipment = shipments.find((s: any) => s.id === item.shipment_id)
              if (!shipment) return null
              return {
                ...item,
                shipments: shipment
              }
            })
            .filter(Boolean)
        }
      }
    }


    // Group incoming by warehouse
    const incomingByWarehouse = new Map()
    ;(incomingShipments || []).forEach((item: any) => {
      if (!item.shipments) return
      const warehouseId = item.shipments.warehouse_id
      if (!incomingByWarehouse.has(warehouseId)) {
        incomingByWarehouse.set(warehouseId, [])
      }
      const pendingQty = parseFloat(item.expected_quantity || 0) - parseFloat(item.received_quantity || 0)
      if (pendingQty > 0) {
        incomingByWarehouse.get(warehouseId).push({
          shipment_id: item.shipments.id,
          shipment_number: item.shipments.shipment_number,
          expected_quantity: parseFloat(item.expected_quantity || 0),
          received_quantity: parseFloat(item.received_quantity || 0),
          pending_quantity: pendingQty,
          expected_arrival_date: item.shipments.expected_arrival_date
        })
      }
    })

    // Get warehouse operations that have stock movements for this product
    // First get stock movements with warehouse_operation_id
    const { data: movementsWithOps, error: opsMovementsError } = await supabase
      .from('stock_movements')
      .select('warehouse_operation_id, warehouse_id')
      .eq('product_id', id)
      .not('warehouse_operation_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100) // Get more movements to find unique operations

    let warehouseOps: any[] = []
    if (movementsWithOps && movementsWithOps.length > 0) {
      const opIds = [...new Set(movementsWithOps.map((m: any) => m.warehouse_operation_id).filter(Boolean))]
      
      if (opIds.length > 0) {
        const { data: operations, error: opsError } = await supabase
          .from('warehouse_operations')
          .select('id, operation_number, operation_type, status, created_at')
          .in('id', opIds)
          .order('created_at', { ascending: false })
          .limit(50)

        if (!opsError && operations) {
          // Map warehouse_id to each operation
          const warehouseMap = new Map(
            movementsWithOps.map((m: any) => [m.warehouse_operation_id, m.warehouse_id])
          )
          
          warehouseOps = operations.map((op: any) => ({
            ...op,
            warehouse_id: warehouseMap.get(op.id)
          }))
        }
      }
    }

    // Group warehouse operations by warehouse
    const opsByWarehouse = new Map()
    warehouseOps.forEach((op: any) => {
      if (!op.warehouse_id) return
      const warehouseId = op.warehouse_id
      if (!opsByWarehouse.has(warehouseId)) {
        opsByWarehouse.set(warehouseId, [])
      }
      opsByWarehouse.get(warehouseId).push({
        id: op.id,
        operation_number: op.operation_number,
        operation_type: op.operation_type,
        status: op.status,
        created_at: op.created_at
      })
    })

    // Enrich warehouses data with incoming and operations
    const enrichedWarehouses = warehousesData.map((warehouse: any) => ({
      ...warehouse,
      incoming: incomingByWarehouse.get(warehouse.warehouse_id) || [],
      warehouse_operations: opsByWarehouse.get(warehouse.warehouse_id) || []
    }))

    // Get stock movements for pagination
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const warehouse_id = searchParams.get('warehouse_id')
    const movement_type = searchParams.get('movement_type')
    const offset = (page - 1) * limit

    let movementsQuery = supabase
      .from('stock_movements')
      .select('*', { count: 'exact' })
      .eq('product_id', id)
      .order('created_at', { ascending: false })

    if (warehouse_id) {
      movementsQuery = movementsQuery.eq('warehouse_id', warehouse_id)
    }
    if (movement_type && movement_type !== 'all') {
      movementsQuery = movementsQuery.eq('movement_type', movement_type)
    }

    movementsQuery = movementsQuery.range(offset, offset + limit - 1)

    const { data: stockMovements, error: movementsError, count } = await movementsQuery

    if (movementsError) {
      console.error('Error fetching stock movements:', movementsError)
    }

    // Enrich stock movements with warehouse, operation, and order (for reserved/released) data
    const enrichedMovements = await Promise.all(
      (stockMovements || []).map(async (movement: any) => {
        // Get warehouse
        const { data: warehouse } = await supabase
          .from('warehouses')
          .select('id, name, code')
          .eq('id', movement.warehouse_id)
          .single()

        // Get warehouse operation if exists
        let operation = null
        if (movement.warehouse_operation_id) {
          const { data: op } = await supabase
            .from('warehouse_operations')
            .select('id, operation_number')
            .eq('id', movement.warehouse_operation_id)
            .single()
          operation = op
        }

        // For reserved/released from order, get order_number for display
        let source_order_number: string | null = null
        if (movement.source_type === 'order' && movement.source_id) {
          const { data: order } = await supabase
            .from('orders')
            .select('order_number')
            .eq('id', movement.source_id)
            .single()
          source_order_number = order?.order_number ?? null
        }

        return {
          ...movement,
          warehouses: warehouse,
          warehouse_operations: operation,
          source_order_number
        }
      })
    )

    return NextResponse.json({
      summary,
      warehouses: enrichedWarehouses,
      stock_movements: enrichedMovements,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Error in product inventory GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
