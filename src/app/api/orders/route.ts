import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// POST - Convert quote to order
export async function POST(request: Request) {
  try {
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

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { quote_id, initial_payment } = body

    if (!quote_id) {
      return NextResponse.json({ error: 'Quote ID required' }, { status: 400 })
    }

    console.log('[ORDER CREATE] Converting quote to order:', quote_id)
    console.time('[ORDER CREATE] Total Time')

    // 1. Generate order number
    console.time('[ORDER CREATE] Generate Order Number')
    const { data: orderNumber, error: orderNumberError } = await supabase
      .rpc('generate_quote_order_number')

    if (orderNumberError || !orderNumber) {
      console.error('[ORDER CREATE] Failed to generate order number:', orderNumberError)
      return NextResponse.json({ error: 'Failed to generate order number' }, { status: 500 })
    }
    console.log('[ORDER CREATE] Generated order number:', orderNumber)
    console.timeEnd('[ORDER CREATE] Generate Order Number')

    // 2. Update quote to order status
    console.time('[ORDER CREATE] Update Quote to Order')
    const { data: updatedQuote, error: updateError } = await supabase
      .from('quotes')
      .update({
        status: 'ordered',
        order_number: orderNumber,
        payment_status: 'not_paid', // Will be updated by trigger if payment added
        updated_at: new Date().toISOString()
      })
      .eq('id', quote_id)
      .select()
      .single()

    if (updateError || !updatedQuote) {
      console.error('[ORDER CREATE] Failed to update quote:', updateError)
      console.error('[ORDER CREATE] Error details:', JSON.stringify(updateError, null, 2))
      return NextResponse.json({ 
        error: 'Failed to convert quote to order',
        details: updateError?.message || 'Unknown error',
        code: updateError?.code
      }, { status: 500 })
    }
    console.log('[ORDER CREATE] Quote converted to order')
    console.timeEnd('[ORDER CREATE] Update Quote to Order')

    // 3. Add initial payment if amount > 0
    if (initial_payment && parseFloat(initial_payment.amount) > 0) {
      console.time('[ORDER CREATE] Insert Initial Payment')
      const { error: paymentError } = await supabase
        .from('quote_payments')
        .insert({
          quote_id: quote_id,
          amount: parseFloat(initial_payment.amount),
          payment_method: initial_payment.payment_method,
          comment: initial_payment.comment || null,
          payment_date: new Date().toISOString(),
          created_by: user.id
        })

      if (paymentError) {
        console.error('[ORDER CREATE] Failed to add initial payment:', paymentError)
        // Continue anyway - order is created
      } else {
        console.log('[ORDER CREATE] Initial payment added')
      }
      console.timeEnd('[ORDER CREATE] Insert Initial Payment')
    }

    console.timeEnd('[ORDER CREATE] Total Time')
    console.log('[ORDER CREATE] ✅ Order creation complete:', orderNumber)

    return NextResponse.json({
      success: true,
      quote_id: quote_id,
      order_number: orderNumber,
      status: 'ordered'
    })

  } catch (error) {
    console.error('[ORDER CREATE] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - List all orders (quotes with order status)
export async function GET(request: Request) {
  try {
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

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const offset = (page - 1) * limit

    console.log(`[ORDERS LIST] Fetching page ${page}, limit ${limit}, search: "${search || 'none'}"`)
    console.time('[ORDERS LIST] Total Time')

    // Build query - filter quotes with order statuses
    let query = supabase
      .from('quotes')
      .select('id, order_number, status, payment_status, final_total_after_discount, updated_at, customers!inner(name)', { count: 'exact' })
      .in('status', ['ordered', 'in_production', 'ready', 'finished'])
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    // Apply search filter
    if (search) {
      query = query.or(`customers.name.ilike.%${search}%,order_number.ilike.%${search}%`)
    }

    // Execute query with pagination
    const { data: orders, error, count } = await query
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[ORDERS LIST] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.timeEnd('[ORDERS LIST] Total Time')
    console.log(`[ORDERS LIST] Fetched ${orders?.length || 0} orders, total: ${count}`)

    return NextResponse.json({
      orders: orders || [],
      total: count || 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0
    })

  } catch (error) {
    console.error('[ORDERS LIST] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
