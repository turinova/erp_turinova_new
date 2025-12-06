import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { order_ids } = body

    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return NextResponse.json({ error: 'Nincs kiválasztott rendelés' }, { status: 400 })
    }

    // Fetch orders to delete
    const { data: ordersToDelete, error: checkError } = await supabaseServer
      .from('customer_orders')
      .select('id, status, order_number')
      .in('id', order_ids)
      .is('deleted_at', null)

    if (checkError) {
      console.error('Error checking orders:', checkError)
      return NextResponse.json({ error: 'Hiba az ellenőrzés során' }, { status: 500 })
    }

    if (!ordersToDelete || ordersToDelete.length === 0) {
      return NextResponse.json({ error: 'Nincs törölhető rendelés' }, { status: 400 })
    }

    // Separate orders by status
    const handedOverOrders = ordersToDelete.filter(o => o.status === 'handed_over')
    const otherOrders = ordersToDelete.filter(o => o.status !== 'handed_over')

    // For handed_over orders, reverse stock movements (create IN movements to reverse OUT movements)
    if (handedOverOrders.length > 0) {
      for (const order of handedOverOrders) {
        // Find all stock movements created by handover for this order
        const { data: handoverMovements, error: movementsError } = await supabaseServer
          .from('stock_movements')
          .select('id, warehouse_id, product_type, accessory_id, material_id, linear_material_id, quantity')
          .eq('source_type', 'customer_order_handover')
          .eq('source_id', order.id)

        if (movementsError) {
          console.error(`Error fetching handover movements for order ${order.id}:`, movementsError)
          continue
        }

        if (handoverMovements && handoverMovements.length > 0) {
          // Create reverse movements (IN instead of OUT, positive quantity instead of negative)
          for (const movement of handoverMovements) {
            const reverseQuantity = Math.abs(Number(movement.quantity)) // Make positive (was negative for OUT)

            const { error: reverseError } = await supabaseServer
              .from('stock_movements')
              .insert({
                warehouse_id: movement.warehouse_id,
                product_type: movement.product_type,
                accessory_id: movement.accessory_id,
                material_id: movement.material_id,
                linear_material_id: movement.linear_material_id,
                quantity: reverseQuantity, // Positive for IN
                movement_type: 'in',
                source_type: 'adjustment',
                source_id: order.id,
                note: `Rendelés törlés - visszavonás: ${order.order_number || order.id}`
              })

            if (reverseError) {
              console.error(`Error creating reverse movement for order ${order.id}:`, reverseError)
              // Continue with other movements
            }
          }
        }
      }
    }

    // Soft delete all orders, items, and payments
    const now = new Date().toISOString()

    // Soft delete orders (any status is allowed now)
    const { error: ordersError } = await supabaseServer
      .from('customer_orders')
      .update({ deleted_at: now })
      .in('id', order_ids)
      .is('deleted_at', null)

    if (ordersError) {
      console.error('Error soft deleting customer orders:', ordersError)
      return NextResponse.json({ error: 'Hiba a rendelések törlése során' }, { status: 500 })
    }

    // Before soft deleting items, delete reservations for 'arrived' items
    // (reservations are stock movements with source_type = 'customer_order_reservation')
    const { data: arrivedItems, error: arrivedItemsError } = await supabaseServer
      .from('customer_order_items')
      .select('id')
      .in('order_id', order_ids)
      .is('deleted_at', null)
      .eq('status', 'arrived')
      .eq('item_type', 'product')

    if (!arrivedItemsError && arrivedItems && arrivedItems.length > 0) {
      const itemIds = arrivedItems.map(item => item.id)
      
      // Delete reservation stock movements (hard delete since stock_movements doesn't have deleted_at)
      const { error: deleteReservationsError } = await supabaseServer
        .from('stock_movements')
        .delete()
        .eq('source_type', 'customer_order_reservation')
        .in('source_id', itemIds)

      if (deleteReservationsError) {
        console.error('Error deleting reservations:', deleteReservationsError)
        // Don't fail, just log
      }
    }

    // Soft delete all items in these orders
    const { error: itemsDeleteError } = await supabaseServer
      .from('customer_order_items')
      .update({ deleted_at: now })
      .in('order_id', order_ids)
      .is('deleted_at', null)

    if (itemsDeleteError) {
      console.error('Error soft deleting customer order items:', itemsDeleteError)
      // Don't fail, just log
    }

    // Soft delete all payments in these orders
    const { error: paymentsDeleteError } = await supabaseServer
      .from('customer_order_payments')
      .update({ deleted_at: now })
      .in('order_id', order_ids)
      .is('deleted_at', null)

    if (paymentsDeleteError) {
      console.error('Error soft deleting customer order payments:', paymentsDeleteError)
      // Don't fail, just log
    }

    return NextResponse.json({ 
      success: true, 
      deleted_count: order_ids.length 
    })
  } catch (error) {
    console.error('Error in DELETE /api/customer-orders/bulk-delete', error)
    return NextResponse.json({ error: 'Belső szerverhiba' }, { status: 500 })
  }
}

