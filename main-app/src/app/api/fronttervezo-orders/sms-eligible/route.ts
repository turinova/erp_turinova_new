import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

import { supabaseServer } from '@/lib/supabase-server'

/**
 * POST /api/fronttervezo-orders/sms-eligible
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { order_ids } = body

    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return NextResponse.json({ error: 'order_ids array is required' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: cookiesToSet => {
            cookiesToSet.forEach(({ name, value, ...options }) => {
              cookieStore.set(name, value, options)
            })
          }
        }
      }
    )

    const {
      data: { user },
      error: userError
    } = await supabaseAuth.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: orders, error: ordersError } = await supabaseServer
      .from('fronttervezo_quotes')
      .select(
        `
        id,
        quote_number,
        order_number,
        customers!inner (
          id,
          name,
          mobile,
          sms_notification
        )
      `
      )
      .in('id', order_ids)
      .is('deleted_at', null)

    if (ordersError) {
      console.error('[FT SMS eligible]', ordersError)
      return NextResponse.json(
        { error: 'Failed to fetch orders', details: ordersError.message },
        { status: 500 }
      )
    }

    const smsEligibleOrders =
      orders
        ?.filter(order => {
          const customers = order.customers as {
            sms_notification?: boolean
            mobile?: string
            name?: string
          } | null
          return (
            customers?.sms_notification === true &&
            customers?.mobile &&
            customers.mobile.trim().length > 0
          )
        })
        .map(order => {
          const customers = order.customers as {
            name: string
            mobile: string
          }
          return {
            id: order.id,
            order_number: order.order_number || order.quote_number,
            customer_name: customers.name,
            customer_mobile: customers.mobile
          }
        }) || []

    return NextResponse.json({ sms_eligible_orders: smsEligibleOrders })
  } catch (error) {
    console.error('[FT SMS eligible]', error)
    return NextResponse.json({ error: 'Failed to check SMS eligibility' }, { status: 500 })
  }
}
