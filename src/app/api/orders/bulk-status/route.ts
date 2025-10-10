import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

/**
 * PATCH /api/orders/bulk-status
 * Update multiple orders' status at once
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { order_ids, new_status } = body

    // Validation
    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return NextResponse.json(
        { error: 'Legalább egy megrendelés ID szükséges' },
        { status: 400 }
      )
    }

    if (!new_status || !['ready', 'finished'].includes(new_status)) {
      return NextResponse.json(
        { error: 'Érvénytelen státusz (csak ready vagy finished)' },
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

    // Update all selected orders
    const { data, error } = await supabase
      .from('quotes')
      .update({
        status: new_status,
        updated_at: new Date().toISOString()
      })
      .in('id', order_ids)
      .select('id')

    if (error) {
      console.error('Bulk status update error:', error)
      return NextResponse.json(
        { error: 'Hiba történt a frissítés során', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      updated_count: data?.length || 0,
      new_status
    })

  } catch (error) {
    console.error('Bulk status update error:', error)
    return NextResponse.json(
      { error: 'Hiba történt a frissítés során' },
      { status: 500 }
    )
  }
}

