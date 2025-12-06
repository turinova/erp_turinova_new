import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * Get payment totals for customer orders
 * Used to calculate remaining balances
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { order_ids } = body

    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return NextResponse.json({ error: 'Nincs kiválasztott rendelés' }, { status: 400 })
    }

    // Fetch payment totals
    const { data: paymentsData, error: paymentsError } = await supabaseServer
      .from('customer_order_payments')
      .select('customer_order_id, amount, deleted_at')
      .in('customer_order_id', order_ids)
      .is('deleted_at', null)

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError)
      return NextResponse.json({ error: 'Hiba a fizetések lekérdezésekor' }, { status: 500 })
    }

    // Calculate total paid per order
    const paymentTotals: Record<string, number> = {}
    paymentsData?.forEach((payment: any) => {
      const orderId = payment.customer_order_id
      const amount = Number(payment.amount || 0)
      paymentTotals[orderId] = (paymentTotals[orderId] || 0) + amount
    })

    return NextResponse.json({
      payment_totals: paymentTotals
    })
  } catch (error) {
    console.error('Error in POST /api/customer-orders/payment-totals', error)
    return NextResponse.json({ error: 'Belső szerverhiba' }, { status: 500 })
  }
}

