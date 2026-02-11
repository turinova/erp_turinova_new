import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// POST - Convert worktop quote to order
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
    const { worktop_quote_id, initial_payment } = body

    if (!worktop_quote_id) {
      return NextResponse.json({ error: 'Worktop quote ID required' }, { status: 400 })
    }

    console.log('[WORKTOP ORDER CREATE] Converting worktop quote to order:', worktop_quote_id)
    console.time('[WORKTOP ORDER CREATE] Total Time')

    // 1. Generate order number
    console.time('[WORKTOP ORDER CREATE] Generate Order Number')
    const { data: orderNumber, error: orderNumberError } = await supabase
      .rpc('generate_worktop_quote_order_number')

    if (orderNumberError || !orderNumber) {
      console.error('[WORKTOP ORDER CREATE] Failed to generate order number:', orderNumberError)
      return NextResponse.json({ error: 'Failed to generate order number' }, { status: 500 })
    }
    console.log('[WORKTOP ORDER CREATE] Generated order number:', orderNumber)
    console.timeEnd('[WORKTOP ORDER CREATE] Generate Order Number')

    // 2. Check if barcode already exists, generate only if missing
    console.time('[WORKTOP ORDER CREATE] Check/Generate Barcode')
    let barcode: string | null = null
    
    // First, check if quote already has a barcode
    const { data: existingQuote, error: fetchError } = await supabase
      .from('worktop_quotes')
      .select('barcode')
      .eq('id', worktop_quote_id)
      .single()

    if (fetchError) {
      console.error('[WORKTOP ORDER CREATE] Failed to fetch existing quote:', fetchError)
      return NextResponse.json({ 
        error: 'Failed to fetch worktop quote',
        details: fetchError.message
      }, { status: 500 })
    }

    if (existingQuote.barcode) {
      // Use existing barcode
      barcode = existingQuote.barcode
      console.log('[WORKTOP ORDER CREATE] Using existing barcode:', barcode)
    } else {
      // Generate new barcode if it doesn't exist
      const { data: generatedBarcode, error: barcodeError } = await supabase
        .rpc('generate_worktop_order_barcode')

      if (barcodeError || !generatedBarcode) {
        console.error('[WORKTOP ORDER CREATE] Failed to generate barcode:', barcodeError)
        return NextResponse.json({ 
          error: 'Failed to generate barcode',
          details: barcodeError?.message || 'Unknown error'
        }, { status: 500 })
      }
      barcode = generatedBarcode
      console.log('[WORKTOP ORDER CREATE] Generated new barcode:', barcode)
    }
    console.timeEnd('[WORKTOP ORDER CREATE] Check/Generate Barcode')

    // 3. Update worktop quote to order status (with barcode)
    console.time('[WORKTOP ORDER CREATE] Update Worktop Quote to Order')
    const { data: updatedQuote, error: updateError } = await supabase
      .from('worktop_quotes')
      .update({
        status: 'ordered',
        order_number: orderNumber,
        barcode: barcode, // Always set/overwrite barcode when creating order
        payment_status: 'not_paid', // Will be updated by trigger if payment added
        updated_at: new Date().toISOString()
      })
      .eq('id', worktop_quote_id)
      .select()
      .single()

    if (updateError || !updatedQuote) {
      console.error('[WORKTOP ORDER CREATE] Failed to update worktop quote:', updateError)
      console.error('[WORKTOP ORDER CREATE] Error details:', JSON.stringify(updateError, null, 2))
      console.error('[WORKTOP ORDER CREATE] Update query details:', {
        worktop_quote_id,
        orderNumber,
        status: 'ordered'
      })
      return NextResponse.json({ 
        error: 'Failed to convert worktop quote to order',
        details: updateError?.message || 'Unknown error',
        code: updateError?.code,
        hint: updateError?.hint || null
      }, { status: 500 })
    }
    console.log('[WORKTOP ORDER CREATE] Worktop quote converted to order')
    console.timeEnd('[WORKTOP ORDER CREATE] Update Worktop Quote to Order')

    // 4. Add initial payment if amount > 0
    if (initial_payment && parseFloat(initial_payment.amount) > 0) {
      console.time('[WORKTOP ORDER CREATE] Insert Initial Payment')
      const { error: paymentError } = await supabase
        .from('worktop_quote_payments')
        .insert({
          worktop_quote_id: worktop_quote_id,
          amount: parseFloat(initial_payment.amount),
          payment_method: initial_payment.payment_method,
          comment: initial_payment.comment || null,
          payment_date: new Date().toISOString(),
          created_by: user.id
        })

      if (paymentError) {
        console.error('[WORKTOP ORDER CREATE] Failed to add initial payment:', paymentError)
        // Continue anyway - order is created
      } else {
        console.log('[WORKTOP ORDER CREATE] Initial payment added')
      }
      console.timeEnd('[WORKTOP ORDER CREATE] Insert Initial Payment')
    }

    console.timeEnd('[WORKTOP ORDER CREATE] Total Time')
    console.log('[WORKTOP ORDER CREATE] ✅ Order creation complete:', orderNumber)

    return NextResponse.json({
      success: true,
      worktop_quote_id: worktop_quote_id,
      order_number: orderNumber,
      barcode: barcode,
      status: 'ordered'
    })

  } catch (error) {
    console.error('[WORKTOP ORDER CREATE] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - List all worktop orders (worktop quotes with order status)
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

    console.log(`[WORKTOP ORDERS LIST] Fetching page ${page}, limit ${limit}, search: "${search || 'none'}"`)
    console.time('[WORKTOP ORDERS LIST] Total Time')

    // Build query - filter worktop quotes with order statuses
    let query = supabase
      .from('worktop_quotes')
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
      console.error('[WORKTOP ORDERS LIST] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.timeEnd('[WORKTOP ORDERS LIST] Total Time')
    console.log(`[WORKTOP ORDERS LIST] Fetched ${orders?.length || 0} orders, total: ${count}`)

    return NextResponse.json({
      orders: orders || [],
      total: count || 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0
    })

  } catch (error) {
    console.error('[WORKTOP ORDERS LIST] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
