import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * GET /api/orders/search-by-barcode?barcode=XXX
 * Search for order by barcode
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const barcode = searchParams.get('barcode')

    if (!barcode) {
      return NextResponse.json(
        { error: 'Vonalkód kötelező' },
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

    // Search for order by barcode - try regular quotes first
    let order: any = null
    let orderType: 'regular' | 'worktop' = 'regular'
    let payments: any[] = []

    // Try regular quotes first
    const { data: regularOrder, error: regularError } = await supabase
      .from('quotes')
      .select(`
        id,
        order_number,
        status,
        payment_status,
        final_total_after_discount,
        barcode,
        updated_at,
        customers(
          id,
          name
        )
      `)
      .eq('barcode', barcode)
      .in('status', ['ordered', 'in_production', 'ready', 'finished'])
      .is('deleted_at', null)
      .maybeSingle()

    if (regularOrder && !regularError) {
      order = regularOrder
      orderType = 'regular'
      
      // Fetch payments from quote_payments
      const { data: regularPayments } = await supabase
        .from('quote_payments')
        .select('amount')
        .eq('quote_id', order.id)
        .is('deleted_at', null)
      
      payments = regularPayments || []
    } else {
      // Try worktop quotes
      const { data: worktopOrder, error: worktopError } = await supabase
        .from('worktop_quotes')
        .select(`
          id,
          order_number,
          status,
          payment_status,
          final_total_after_discount,
          barcode,
          updated_at,
          customers!inner(
            id,
            name
          )
        `)
        .eq('barcode', barcode)
        .in('status', ['ordered', 'in_production', 'ready', 'finished'])
        .is('deleted_at', null)
        .maybeSingle()

      if (worktopOrder && !worktopError) {
        order = worktopOrder
        orderType = 'worktop'
        
        // Fetch payments from worktop_quote_payments
        const { data: worktopPayments } = await supabase
          .from('worktop_quote_payments')
          .select('amount')
          .eq('worktop_quote_id', order.id)
          .is('deleted_at', null)
        
        payments = worktopPayments || []
      }
    }

    if (!order) {
      return NextResponse.json(
        { error: 'Vonalkód nem található' },
        { status: 404 }
      )
    }

    const totalPaid = payments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0
    const finalTotal = Number(order.final_total_after_discount) || 0
    const remainingBalance = finalTotal - totalPaid

    // Transform response - same structure for both types
    const transformedOrder = {
      id: order.id,
      order_number: order.order_number,
      customer_name: order.customers?.name || 'Unknown',
      final_total: finalTotal,
      status: order.status,
      payment_status: order.payment_status || 'not_paid',
      barcode: order.barcode,
      updated_at: order.updated_at,
      total_paid: totalPaid,
      remaining_balance: remainingBalance,
      order_type: orderType // Add type indicator
    }

    return NextResponse.json(transformedOrder)

  } catch (error) {
    console.error('Barcode search error:', error)
    return NextResponse.json(
      { error: 'Hiba történt a keresés során' },
      { status: 500 }
    )
  }
}

