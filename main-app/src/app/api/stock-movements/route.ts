import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET /api/stock-movements - list all stock movements with joins
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const movementType = searchParams.get('movement_type') // optional: 'in', 'out', 'adjustment', 'all'
    const sourceType = searchParams.get('source_type') // optional
    const warehouseId = searchParams.get('warehouse_id') // optional
    const search = (searchParams.get('search') || '').trim() // product name/SKU search

    let query = supabaseServer
      .from('stock_movements')
      .select(`
        id,
        stock_movement_number,
        warehouse_id,
        warehouses:warehouse_id(name),
        product_type,
        accessory_id,
        material_id,
        linear_material_id,
        quantity,
        movement_type,
        source_type,
        source_id,
        created_at,
        note,
        accessories:accessory_id(id, name, sku),
        materials:material_id(id, name),
        linear_materials:linear_material_id(id, name)
      `)
      .order('created_at', { ascending: false })

    // Apply filters
    if (movementType && movementType !== 'all') {
      query = query.eq('movement_type', movementType)
    }
    if (sourceType && sourceType !== 'all') {
      query = query.eq('source_type', sourceType)
    }
    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId)
    }

    const { data, error } = await query
    if (error) {
      console.error('Error listing stock movements:', error)
      return NextResponse.json({ error: 'Failed to fetch stock movements' }, { status: 500 })
    }

    // Fetch source references (POS orders, shipments, etc.)
    const sourceIdsByType = new Map<string, string[]>()
    if (data) {
      data.forEach((sm: any) => {
        if (sm.source_type && sm.source_id) {
          if (!sourceIdsByType.has(sm.source_type)) {
            sourceIdsByType.set(sm.source_type, [])
          }
          sourceIdsByType.get(sm.source_type)!.push(sm.source_id)
        }
      })
    }

    // Fetch POS orders
    const posOrderIds = sourceIdsByType.get('pos_sale') || []
    const { data: posOrders } = posOrderIds.length > 0
      ? await supabaseServer
          .from('pos_orders')
          .select('id, pos_order_number')
          .in('id', posOrderIds)
      : { data: [] }
    const posOrderMap = new Map((posOrders || []).map((po: any) => [po.id, po.pos_order_number]))

    // Fetch shipments
    const shipmentIds = sourceIdsByType.get('purchase_receipt') || []
    const { data: shipments } = shipmentIds.length > 0
      ? await supabaseServer
          .from('shipments')
          .select('id, shipment_number')
          .in('id', shipmentIds)
      : { data: [] }
    const shipmentMap = new Map((shipments || []).map((s: any) => [s.id, s.shipment_number]))

    // Transform data
    const stockMovements = (data || []).map((sm: any) => {
      // Get product name and SKU based on product_type
      let productName = ''
      let sku = ''
      
      if (sm.product_type === 'accessory' && sm.accessories) {
        productName = sm.accessories.name || ''
        sku = sm.accessories.sku || ''
      } else if (sm.product_type === 'material' && sm.materials) {
        productName = sm.materials.name || ''
      } else if (sm.product_type === 'linear_material' && sm.linear_materials) {
        productName = sm.linear_materials.name || ''
      }

      // Get source reference
      let sourceReference = '-'
      if (sm.source_type === 'pos_sale' && sm.source_id) {
        sourceReference = posOrderMap.get(sm.source_id) || sm.source_id
      } else if (sm.source_type === 'purchase_receipt' && sm.source_id) {
        sourceReference = shipmentMap.get(sm.source_id) || sm.source_id
      } else if (sm.source_id) {
        sourceReference = sm.source_id.substring(0, 8) + '...'
      }

      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase()
        const matchesName = productName.toLowerCase().includes(searchLower)
        const matchesSku = sku.toLowerCase().includes(searchLower)
        const matchesNumber = sm.stock_movement_number?.toLowerCase().includes(searchLower)
        if (!matchesName && !matchesSku && !matchesNumber) {
          return null
        }
      }

      return {
        id: sm.id,
        stock_movement_number: sm.stock_movement_number || '',
        warehouse_name: sm.warehouses?.name || '',
        product_type: sm.product_type,
        product_name: productName,
        sku: sku,
        accessory_id: sm.accessory_id || null,
        material_id: sm.material_id || null,
        linear_material_id: sm.linear_material_id || null,
        quantity: Number(sm.quantity) || 0,
        movement_type: sm.movement_type,
        source_type: sm.source_type,
        source_id: sm.source_id,
        source_reference: sourceReference,
        created_at: sm.created_at,
        note: sm.note || ''
      }
    }).filter(Boolean) // Remove null entries from search filter

    return NextResponse.json({ stock_movements: stockMovements })
  } catch (e) {
    console.error('Error in GET /api/stock-movements', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

