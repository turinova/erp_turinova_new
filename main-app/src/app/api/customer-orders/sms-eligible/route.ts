import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * Check which customer_orders are eligible for SMS notification
 * Eligibility criteria:
 * 1. Customer order status is 'arrived' (all items arrived)
 * 2. Customer has valid mobile number
 * 3. SMS not already sent (sms_sent_at is NULL)
 */
export async function POST(request: NextRequest) {
  try {
    const { order_ids } = await request.json()

    console.log('[SMS Eligibility] Checking eligibility for customer order IDs:', order_ids)

    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      console.log('[SMS Eligibility] No order IDs provided')
      return NextResponse.json(
        { error: 'No order IDs provided' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookies) => {
            cookies.forEach(({ name, value, ...options }) => {
              cookieStore.set(name, value, options)
            })
          }
        }
      }
    )

    // Fetch customer orders with status 'arrived' and valid mobile number
    // Try with sms_sent_at first, fallback if column doesn't exist
    let orders: any[] = []
    let ordersError: any = null
    
    const { data: ordersWithSms, error: errorWithSms } = await supabase
      .from('customer_orders')
      .select(`
        id,
        order_number,
        customer_name,
        customer_mobile,
        total_gross,
        created_at,
        sms_sent_at,
        status
      `)
      .in('id', order_ids)
      .eq('status', 'arrived')
      .is('deleted_at', null)

    if (errorWithSms) {
      console.log('[SMS Eligibility] Error with sms_sent_at column, trying without it:', errorWithSms.message)
      // If column doesn't exist, retry without it
      const { data: ordersWithoutSms, error: errorWithoutSms } = await supabase
        .from('customer_orders')
        .select(`
          id,
          order_number,
          customer_name,
          customer_mobile,
          total_gross,
          created_at,
          status
        `)
        .in('id', order_ids)
        .eq('status', 'arrived')
        .is('deleted_at', null)
      
      if (errorWithoutSms) {
        console.error('[SMS Eligibility] Error fetching customer orders:', errorWithoutSms)
        return NextResponse.json({
          sms_eligible_orders: []
        })
      }
      
      orders = ordersWithoutSms || []
      // Assume sms_sent_at is NULL for all (column doesn't exist yet)
      orders = orders.map(o => ({ ...o, sms_sent_at: null }))
    } else {
      orders = ordersWithSms || []
    }

    if (!orders || orders.length === 0) {
      console.log('[SMS Eligibility] No orders found with status arrived for IDs:', order_ids)
      console.log('[SMS Eligibility] Checking if orders exist with different status...')
      
      // Debug: Check what status these orders actually have
      const { data: debugOrders } = await supabase
        .from('customer_orders')
        .select('id, order_number, status, customer_mobile')
        .in('id', order_ids)
        .is('deleted_at', null)
      
      console.log('[SMS Eligibility] Debug - Orders found:', debugOrders)
      return NextResponse.json({
        sms_eligible_orders: []
      })
    }

    console.log('[SMS Eligibility] Found', orders.length, 'orders with status arrived')
    console.log('[SMS Eligibility] Orders details:', orders.map(o => ({
      order_number: o.order_number,
      status: o.status,
      customer_mobile: o.customer_mobile,
      sms_sent_at: o.sms_sent_at
    })))

    const eligibleOrders: any[] = []

    // Filter orders that have mobile number and SMS not already sent
    for (const order of orders) {
      // Skip if no mobile number
      if (!order.customer_mobile || order.customer_mobile.trim() === '') {
        console.log('[SMS Eligibility] - Skipped:', order.order_number, '- No mobile number')
        continue
      }

      // Skip if SMS already sent
      if (order.sms_sent_at) {
        console.log('[SMS Eligibility] - Skipped:', order.order_number, '- SMS already sent')
        continue
      }

      console.log('[SMS Eligibility] - ✅ ELIGIBLE! Adding to list:', order.order_number)

      // Format price
      const totalPriceFormatted = new Intl.NumberFormat('hu-HU').format(Math.round(order.total_gross)) + ' Ft'

      // Format date as YYYY-MM-DD
      const createdDate = new Date(order.created_at).toISOString().split('T')[0]

      eligibleOrders.push({
        order_id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        customer_mobile: order.customer_mobile,
        total_price: Math.round(order.total_gross),
        total_price_formatted: totalPriceFormatted,
        created_at: createdDate
      })
    }

    console.log('[SMS Eligibility] Final result:', eligibleOrders.length, 'eligible orders')

    return NextResponse.json({
      sms_eligible_orders: eligibleOrders
    })

  } catch (error) {
    console.error('[SMS Eligibility] ERROR:', error)
    // Return empty array instead of error to gracefully handle any issues
    return NextResponse.json({
      sms_eligible_orders: []
    })
  }
}

