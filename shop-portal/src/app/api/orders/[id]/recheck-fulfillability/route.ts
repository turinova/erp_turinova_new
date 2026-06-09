import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { recalculateOrderFulfillability } from '@/lib/order-fulfillability'

/**
 * POST /api/orders/[id]/recheck-fulfillability
 * Relink order lines by SKU, recompute fulfillability from stock, optionally reserve.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .is('deleted_at', null)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Rendelés nem található' }, { status: 404 })
    }

    if (order.status !== 'new') {
      return NextResponse.json(
        { error: 'Csak Új rendelés készletének ellenőrizhető újra' },
        { status: 400 }
      )
    }

    const result = await recalculateOrderFulfillability(supabase, orderId, {
      reserveIfFullyFulfillable: true,
      createdBy: user.id,
    })

    if (result == null) {
      return NextResponse.json(
        { error: 'Nem sikerült kiszámolni a készletet (nincs kapcsolt termék a rendelésben?)' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      fulfillability_status: result.fulfillability_status,
      linked_items: result.linked_items,
      stock_reserved: result.stock_reserved,
    })
  } catch (error) {
    console.error('Recheck fulfillability error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Hiba' },
      { status: 500 }
    )
  }
}
