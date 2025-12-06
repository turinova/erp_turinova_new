import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { order_ids } = body

    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return NextResponse.json({ error: 'Nincs kiválasztott rendelés' }, { status: 400 })
    }

    const results = []
    
    for (const orderId of order_ids) {
      // Call the PostgreSQL function to hand over the order
      const { data, error } = await supabaseServer.rpc('hand_over_customer_order', {
        p_customer_order_id: orderId,
        p_warehouse_id: null // Use default warehouse
      })

      if (error) {
        console.error(`[HANDOVER] Error handing over order ${orderId}:`, error)
        results.push({ id: orderId, success: false, error: error.message })
      } else if (data && data.success) {
        results.push({ id: orderId, success: true })
      } else {
        results.push({ id: orderId, success: false, error: data?.error || 'Ismeretlen hiba' })
      }
    }

    const successCount = results.filter(r => r.success).length
    const errorCount = results.filter(r => !r.success).length

    if (errorCount > 0) {
      return NextResponse.json({
        success: true,
        handed_over_count: successCount,
        error_count: errorCount,
        results
      }, { status: 207 }) // 207 Multi-Status
    }

    return NextResponse.json({
      success: true,
      handed_over_count: successCount,
      results
    })
  } catch (error) {
    console.error('Error in POST /api/customer-orders/handover', error)
    return NextResponse.json({ error: 'Belső szerverhiba' }, { status: 500 })
  }
}

