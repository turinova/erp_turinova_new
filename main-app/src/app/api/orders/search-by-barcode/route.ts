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

    // Search for order by barcode
    const { data: order, error } = await supabase
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
      .single()

    if (error || !order) {
      return NextResponse.json(
        { error: 'Vonalkód nem található' },
        { status: 404 }
      )
    }

    // Fetch payments to calculate total paid
    const { data: payments } = await supabase
      .from('quote_payments')
      .select('amount')
      .eq('quote_id', order.id)
      .is('deleted_at', null)

    const totalPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || 0
    const finalTotal = order.final_total_after_discount || 0
    const remainingBalance = finalTotal - totalPaid

    // Transform response
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
      remaining_balance: remainingBalance
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

