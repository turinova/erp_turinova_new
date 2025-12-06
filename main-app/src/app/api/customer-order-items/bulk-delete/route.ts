import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { item_ids } = body

    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
      return NextResponse.json({ error: 'Nincs kiválasztott tétel' }, { status: 400 })
    }

    // Fetch items to delete with full details
    const { data: itemsToDelete, error: checkError } = await supabaseServer
      .from('customer_order_items')
      .select('id, status, order_id, product_type, accessory_id, material_id, linear_material_id, quantity, reservation_warehouse_id')
      .in('id', item_ids)
      .is('deleted_at', null)

    if (checkError) {
      console.error('Error checking items:', checkError)
      return NextResponse.json({ error: 'Hiba az ellenőrzés során' }, { status: 500 })
    }

    if (!itemsToDelete || itemsToDelete.length === 0) {
      return NextResponse.json({ error: 'Nincs törölhető tétel' }, { status: 400 })
    }

    // Separate items by status
    const handedOverItems = itemsToDelete.filter(item => item.status === 'handed_over')
    const arrivedItems = itemsToDelete.filter(item => item.status === 'arrived')

    // For handed_over items, reverse stock movements
    if (handedOverItems.length > 0) {
      for (const item of handedOverItems) {
        // Find the stock movement for this specific item
        // Stock movements are created with source_id = order_id, so we need to match by product details
        const { data: handoverMovements, error: movementsError } = await supabaseServer
          .from('stock_movements')
          .select('id, warehouse_id, product_type, accessory_id, material_id, linear_material_id, quantity')
          .eq('source_type', 'customer_order_handover')
          .eq('source_id', item.order_id)
          .eq('product_type', item.product_type)
          .eq('movement_type', 'out')

        if (movementsError) {
          console.error(`Error fetching handover movements for item ${item.id}:`, movementsError)
          continue
        }

        if (handoverMovements && handoverMovements.length > 0) {
          // Find the matching movement by product FK and quantity
          // Match by FK first, then by quantity (absolute value) to handle multiple items of same product
          let matchingMovement = null
          const itemQuantity = Math.abs(Number(item.quantity))
          
          if (item.product_type === 'accessory' && item.accessory_id) {
            matchingMovement = handoverMovements.find(m => 
              m.accessory_id === item.accessory_id && 
              Math.abs(Number(m.quantity)) === itemQuantity
            )
          } else if (item.product_type === 'material' && item.material_id) {
            matchingMovement = handoverMovements.find(m => 
              m.material_id === item.material_id && 
              Math.abs(Number(m.quantity)) === itemQuantity
            )
          } else if (item.product_type === 'linear_material' && item.linear_material_id) {
            matchingMovement = handoverMovements.find(m => 
              m.linear_material_id === item.linear_material_id && 
              Math.abs(Number(m.quantity)) === itemQuantity
            )
          }

          if (matchingMovement) {
            // Create reverse movement (IN instead of OUT, positive quantity instead of negative)
            const reverseQuantity = Math.abs(Number(matchingMovement.quantity))

            const { error: reverseError } = await supabaseServer
              .from('stock_movements')
              .insert({
                warehouse_id: matchingMovement.warehouse_id,
                product_type: matchingMovement.product_type,
                accessory_id: matchingMovement.accessory_id,
                material_id: matchingMovement.material_id,
                linear_material_id: matchingMovement.linear_material_id,
                quantity: reverseQuantity, // Positive for IN
                movement_type: 'in',
                source_type: 'adjustment',
                source_id: item.order_id,
                note: `Rendelés törlés - visszavonás: ${item.id}`
              })

            if (reverseError) {
              console.error(`Error creating reverse movement for item ${item.id}:`, reverseError)
              // Continue with other items
            }
          } else {
            console.warn(`No matching stock movement found for item ${item.id} (product_type: ${item.product_type}, quantity: ${itemQuantity})`)
          }
        }
      }
    }

    // For arrived items, delete reservations
    if (arrivedItems.length > 0) {
      const arrivedItemIds = arrivedItems.map(item => item.id)
      
      // Delete reservation stock movements (hard delete since stock_movements doesn't have deleted_at)
      const { error: deleteReservationsError } = await supabaseServer
        .from('stock_movements')
        .delete()
        .eq('source_type', 'customer_order_reservation')
        .in('source_id', arrivedItemIds)

      if (deleteReservationsError) {
        console.error('Error deleting reservations:', deleteReservationsError)
        // Don't fail, just log
      }
    }

    // Soft delete: set deleted_at timestamp (any status is allowed now)
    const { error } = await supabaseServer
      .from('customer_order_items')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', item_ids)
      .is('deleted_at', null)  // Only delete if not already deleted

    if (error) {
      console.error('Error soft deleting customer order items:', error)
      return NextResponse.json({ error: 'Hiba a törlés során' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      deleted_count: item_ids.length 
    })
  } catch (error) {
    console.error('Error in DELETE /api/customer-order-items/bulk-delete', error)
    return NextResponse.json({ error: 'Belső szerverhiba' }, { status: 500 })
  }
}

