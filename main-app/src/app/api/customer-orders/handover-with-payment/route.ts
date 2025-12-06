import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * Handover customer orders with payment creation
 * - Handovers all selected orders
 * - For orders with remaining balance, creates a 'cash' payment
 * - If payment creation fails, rolls back the handover
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { order_ids } = body

    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return NextResponse.json({ error: 'Nincs kiválasztott rendelés' }, { status: 400 })
    }

    // Step 1: Fetch order details and calculate remaining balances
    const { data: ordersData, error: ordersError } = await supabaseServer
      .from('customer_orders')
      .select('id, order_number, total_gross, status')
      .in('id', order_ids)
      .is('deleted_at', null)

    if (ordersError || !ordersData) {
      return NextResponse.json({ error: 'Hiba a rendelések lekérdezésekor' }, { status: 500 })
    }

    // Step 2: Fetch payment totals for all orders
    const { data: paymentsData, error: paymentsError } = await supabaseServer
      .from('customer_order_payments')
      .select('customer_order_id, amount, deleted_at')
      .in('customer_order_id', order_ids)
      .is('deleted_at', null)

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError)
      return NextResponse.json({ error: 'Hiba a fizetések lekérdezésekor' }, { status: 500 })
    }

    // Calculate remaining balance for each order
    const paymentTotals: Record<string, number> = {}
    paymentsData?.forEach((payment: any) => {
      const orderId = payment.customer_order_id
      const amount = Number(payment.amount || 0)
      paymentTotals[orderId] = (paymentTotals[orderId] || 0) + amount
    })

    const ordersWithBalance = ordersData.map(order => {
      const totalPaid = paymentTotals[order.id] || 0
      const totalGross = Number(order.total_gross) || 0
      const remainingBalance = totalGross - totalPaid
      return {
        id: order.id,
        order_number: order.order_number,
        total_gross: totalGross,
        total_paid: totalPaid,
        remaining_balance: remainingBalance
      }
    })

    // Step 3: Store previous statuses before handover
    const previousStatuses: Record<string, string> = {}
    ordersData.forEach(order => {
      previousStatuses[order.id] = order.status
    })

    // Step 4: Perform handover for all orders
    const handoverResults: Array<{ id: string; success: boolean; error?: string }> = []
    
    for (const orderId of order_ids) {
      const { data, error } = await supabaseServer.rpc('hand_over_customer_order', {
        p_customer_order_id: orderId,
        p_warehouse_id: null
      })

      if (error) {
        console.error(`[HANDOVER] Error handing over order ${orderId}:`, error)
        handoverResults.push({ id: orderId, success: false, error: error.message })
      } else if (data && data.success) {
        handoverResults.push({ id: orderId, success: true })
      } else {
        handoverResults.push({ id: orderId, success: false, error: data?.error || 'Ismeretlen hiba' })
      }
    }

    const handoverSuccessCount = handoverResults.filter(r => r.success).length
    if (handoverSuccessCount === 0) {
      return NextResponse.json({ 
        error: 'Egyik rendelés sem adható át',
        handover_results: handoverResults
      }, { status: 400 })
    }

    // Step 5: Create payments for orders with remaining balance
    const paymentResults: Array<{ order_id: string; success: boolean; error?: string; amount?: number }> = []
    const ordersToRollback: string[] = []

    for (const orderInfo of ordersWithBalance) {
      // Only create payment if there's a remaining balance and handover was successful
      const handoverResult = handoverResults.find(r => r.id === orderInfo.id)
      if (orderInfo.remaining_balance > 0 && handoverResult?.success) {
        try {
          const { data: payment, error: paymentError } = await supabaseServer
            .from('customer_order_payments')
            .insert({
              customer_order_id: orderInfo.id,
              payment_type: 'cash',
              amount: orderInfo.remaining_balance,
              status: 'completed'
            })
            .select()
            .single()

          if (paymentError) {
            console.error(`Error creating payment for order ${orderInfo.id}:`, paymentError)
            paymentResults.push({ 
              order_id: orderInfo.id, 
              success: false, 
              error: paymentError.message,
              amount: orderInfo.remaining_balance
            })
            // Mark for rollback
            ordersToRollback.push(orderInfo.id)
          } else {
            paymentResults.push({ 
              order_id: orderInfo.id, 
              success: true,
              amount: orderInfo.remaining_balance
            })
          }
        } catch (error: any) {
          console.error(`Error creating payment for order ${orderInfo.id}:`, error)
          paymentResults.push({ 
            order_id: orderInfo.id, 
            success: false, 
            error: error.message || 'Ismeretlen hiba',
            amount: orderInfo.remaining_balance
          })
          ordersToRollback.push(orderInfo.id)
        }
      } else if (orderInfo.remaining_balance <= 0) {
        // No payment needed (already paid or no balance)
        paymentResults.push({ 
          order_id: orderInfo.id, 
          success: true,
          amount: 0
        })
      }
    }

    // Step 6: Rollback handover for orders where payment creation failed
    if (ordersToRollback.length > 0) {
      console.log(`[HANDOVER] Rolling back handover for ${ordersToRollback.length} orders due to payment failures`)
      
      for (const orderId of ordersToRollback) {
        // Get the previous status before handover
        const previousStatus = previousStatuses[orderId] || 'arrived'
        const order = ordersData.find(o => o.id === orderId)

        // Revert customer_order status
        await supabaseServer
          .from('customer_orders')
          .update({ 
            status: previousStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId)

        // Revert customer_order_items status
        // If previous status was 'arrived', items should be 'arrived', otherwise 'ordered'
        const itemStatus = previousStatus === 'arrived' ? 'arrived' : 'ordered'
        await supabaseServer
          .from('customer_order_items')
          .update({ 
            status: itemStatus,
            updated_at: new Date().toISOString()
          })
          .eq('order_id', orderId)
          .eq('item_type', 'product')

        // Reverse stock movements (create IN movements to reverse OUT movements)
        const { data: handoverMovements, error: movementsError } = await supabaseServer
          .from('stock_movements')
          .select('id, warehouse_id, product_type, accessory_id, material_id, linear_material_id, quantity')
          .eq('source_type', 'customer_order_handover')
          .eq('source_id', orderId)

        if (!movementsError && handoverMovements) {
          for (const movement of handoverMovements) {
            const reverseQuantity = Math.abs(Number(movement.quantity)) // Make positive (was negative for OUT)

            await supabaseServer
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
                source_id: orderId,
                note: `Handover visszavonás - fizetés hiba: ${order?.order_number || orderId}`
              })
          }
        }
      }

      return NextResponse.json({
        success: false,
        error: 'Fizetés létrehozása sikertelen volt, az átadás visszavonva',
        handed_over_count: handoverSuccessCount - ordersToRollback.length,
        rollback_count: ordersToRollback.length,
        handover_results: handoverResults,
        payment_results: paymentResults
      }, { status: 400 })
    }

    const paymentSuccessCount = paymentResults.filter(r => r.success).length
    const paymentCreatedCount = paymentResults.filter(r => r.success && r.amount && r.amount > 0).length

    return NextResponse.json({
      success: true,
      handed_over_count: handoverSuccessCount,
      payment_created_count: paymentCreatedCount,
      handover_results: handoverResults,
      payment_results: paymentResults
    })
  } catch (error) {
    console.error('Error in POST /api/customer-orders/handover-with-payment', error)
    return NextResponse.json({ error: 'Belső szerverhiba' }, { status: 500 })
  }
}

