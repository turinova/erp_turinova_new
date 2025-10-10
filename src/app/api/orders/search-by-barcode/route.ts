import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

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
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
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

    // Transform response
    const transformedOrder = {
      id: order.id,
      order_number: order.order_number,
      customer_name: order.customers?.name || 'Unknown',
      final_total: order.final_total_after_discount || 0,
      status: order.status,
      payment_status: order.payment_status || 'not_paid',
      barcode: order.barcode
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

