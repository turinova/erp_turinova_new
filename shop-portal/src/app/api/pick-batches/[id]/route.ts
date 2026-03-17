import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/pick-batches/[id]
 * Get one batch with linked orders and order items (for pick list)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: batch, error: batchError } = await supabase
      .from('pick_batches')
      .select(`
        id,
        code,
        name,
        status,
        created_by,
        created_by_user:created_by(id, email, full_name),
        started_at,
        completed_at,
        created_at,
        updated_at
      `)
      .eq('id', id)
      .single()

    if (batchError || !batch) {
      return NextResponse.json(
        { error: 'Begyűjtés nem található' },
        { status: 404 }
      )
    }

    const { data: batchOrders } = await supabase
      .from('pick_batch_orders')
      .select('order_id')
      .eq('pick_batch_id', id)
      .order('created_at', { ascending: true })

    const orderIds = (batchOrders || []).map((r: any) => r.order_id)
    if (orderIds.length === 0) {
      return NextResponse.json({
        pick_batch: batch,
        orders: [],
        order_items_by_order: {}
      })
    }

    const { data: orders } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        customer_firstname,
        customer_lastname,
        customer_email,
        status,
        shipping_method_name,
        order_date,
        total_gross,
        currency_code
      `)
      .in('id', orderIds)
      .is('deleted_at', null)

    const orderMap = new Map((orders || []).map((o: any) => [o.id, o]))
    const orderedOrders = orderIds.map((oid: string) => orderMap.get(oid)).filter(Boolean)

    const { data: orderItems } = await supabase
      .from('order_items')
      .select('id, order_id, product_name, product_sku, quantity, product_gtin')
      .in('order_id', orderIds)
      .is('deleted_at', null)
      .order('order_id', { ascending: true })
      .order('product_sku', { ascending: true })

    const order_items_by_order: Record<string, any[]> = {}
    for (const oid of orderIds) {
      order_items_by_order[oid] = (orderItems || []).filter((i: any) => i.order_id === oid)
    }

    return NextResponse.json({
      pick_batch: batch,
      orders: orderedOrders,
      order_items_by_order
    })
  } catch (err) {
    console.error('Error in pick-batches [id] GET:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/pick-batches/[id]
 * Update batch (name or status: in_progress | completed | cancelled)
 * - in_progress: set all linked orders to status 'picking'
 * - completed: set all to 'picked'
 * - cancelled: set all to 'new'
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { name, status: newStatus } = body

    const { data: batch, error: batchError } = await supabase
      .from('pick_batches')
      .select('id, status')
      .eq('id', id)
      .single()

    if (batchError || !batch) {
      return NextResponse.json(
        { error: 'Begyűjtés nem található' },
        { status: 404 }
      )
    }

    const update: Record<string, unknown> = {}
    if (name !== undefined) update.name = name || null
    if (newStatus !== undefined) {
      const allowed = ['draft', 'in_progress', 'completed', 'cancelled']
      if (!allowed.includes(newStatus)) {
        return NextResponse.json(
          { error: 'Érvénytelen státusz' },
          { status: 400 }
        )
      }
      update.status = newStatus
      if (newStatus === 'in_progress') {
        update.started_at = new Date().toISOString()
      } else if (newStatus === 'completed') {
        update.completed_at = new Date().toISOString()
      }
    }

    if (Object.keys(update).length === 0) {
      const { data: b } = await supabase.from('pick_batches').select('*').eq('id', id).single()
      return NextResponse.json({ pick_batch: b })
    }

    const { data: updatedBatch, error: updateError } = await supabase
      .from('pick_batches')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating pick batch:', updateError)
      return NextResponse.json(
        { error: updateError.message || 'Hiba a begyűjtés frissítésekor' },
        { status: 500 }
      )
    }

    if (newStatus === 'in_progress' || newStatus === 'completed' || newStatus === 'cancelled') {
      const { data: batchOrderRows } = await supabase
        .from('pick_batch_orders')
        .select('order_id')
        .eq('pick_batch_id', id)

      const orderIds = (batchOrderRows || []).map((r: any) => r.order_id)
      if (orderIds.length > 0) {
        const orderStatus = newStatus === 'in_progress' ? 'picking' : newStatus === 'completed' ? 'picked' : 'new'
        const { error: ordersUpdateError } = await supabase
          .from('orders')
          .update({ status: orderStatus })
          .in('id', orderIds)

        if (ordersUpdateError) {
          console.error('Error updating order statuses:', ordersUpdateError)
        }
      }
    }

    return NextResponse.json({ pick_batch: updatedBatch })
  } catch (err) {
    console.error('Error in pick-batches [id] PATCH:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
