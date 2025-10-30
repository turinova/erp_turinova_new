import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * Debug endpoint to check item and order details
 */
export async function POST(request: NextRequest) {
  try {
    const { item_ids } = await request.json()

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

    // Fetch items with full details
    const { data: items, error } = await supabase
      .from('shop_order_items')
      .select(`
        id,
        order_id,
        product_name,
        status,
        shop_orders!inner(
          id,
          order_number,
          customer_name,
          customer_mobile,
          status
        )
      `)
      .in('id', item_ids)
      .is('deleted_at', null)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get unique orders
    const orderIds = [...new Set(items?.map(i => i.order_id) || [])]

    // For each order, get all its items
    const orderDetails = []
    for (const orderId of orderIds) {
      const { data: allItems } = await supabase
        .from('shop_order_items')
        .select('id, status')
        .eq('order_id', orderId)
        .is('deleted_at', null)

      const order = items?.find(i => i.order_id === orderId)?.shop_orders

      // Check customer
      const { data: customer } = await supabase
        .from('customers')
        .select('name, mobile, sms_notification')
        .eq('name', order?.customer_name)
        .is('deleted_at', null)
        .single()

      orderDetails.push({
        order_id: orderId,
        order_number: order?.order_number,
        customer_name: order?.customer_name,
        customer_mobile: order?.customer_mobile,
        current_order_status: order?.status,
        customer_in_db: customer ? {
          mobile: customer.mobile,
          sms_notification: customer.sms_notification
        } : null,
        all_items: allItems?.map(i => ({
          id: i.id,
          status: i.status,
          is_selected: item_ids.includes(i.id)
        }))
      })
    }

    return NextResponse.json({
      selected_items: items,
      order_details: orderDetails
    })

  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

