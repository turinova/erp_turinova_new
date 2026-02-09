import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * POST /api/worktop-orders/sms-eligible
 * Check which worktop orders are eligible for SMS notifications
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { order_ids } = body

    // Validate input
    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return NextResponse.json(
        { error: 'order_ids array is required' },
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

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch orders with customer data
    const { data: orders, error: ordersError } = await supabase
      .from('worktop_quotes')
      .select(`
        id,
        quote_number,
        order_number,
        customers!inner (
          id,
          name,
          mobile,
          sms_notification
        )
      `)
      .in('id', order_ids)

    if (ordersError) {
      console.error('Error fetching worktop orders:', ordersError)
      return NextResponse.json(
        { error: 'Failed to fetch orders', details: ordersError.message },
        { status: 500 }
      )
    }

    // Filter SMS-eligible orders (sms_notification = true AND has valid mobile)
    const smsEligibleOrders = orders
      ?.filter(order => 
        order.customers?.sms_notification === true && 
        order.customers?.mobile && 
        order.customers.mobile.trim().length > 0
      )
      .map(order => ({
        id: order.id,
        order_number: order.order_number || order.quote_number,
        customer_name: order.customers.name,
        customer_mobile: order.customers.mobile
      })) || []

    console.log(`[Worktop SMS] Found ${smsEligibleOrders.length} SMS-eligible orders out of ${orders?.length || 0}`)

    return NextResponse.json({
      sms_eligible_orders: smsEligibleOrders
    })

  } catch (error) {
    console.error('Error checking worktop SMS eligibility:', error)
    return NextResponse.json(
      { error: 'Failed to check SMS eligibility' },
      { status: 500 }
    )
  }
}
