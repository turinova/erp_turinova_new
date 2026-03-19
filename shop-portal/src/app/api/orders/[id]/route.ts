import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getAllowedNextStatus, canDeleteOrder } from '@/lib/order-status'
import { releaseReservedStockForOrder, consumeReservedAndPostOutbound } from '@/lib/order-reservation'
import { sendOrderStatusEmailNotification } from '@/lib/order-status-notification-send'

/**
 * PATCH /api/orders/[id]
 * Update order fields (customer snapshot, billing, shipping, payment).
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

    const body = await request.json()

    const update: Record<string, unknown> = {}
    /** Set when body.status triggers a valid transition; used after update for customer e-mail. */
    let previousStatusForEmail: string | null = null
    let newStatusForEmail: string | null = null

    if (body.customer_person_id !== undefined) {
      update.customer_person_id = body.customer_person_id || null
      if (body.customer_person_id) {
        update.customer_company_id = null
        update.customer_company_name = null
      }
    }
    if (body.customer_company_id !== undefined) {
      update.customer_company_id = body.customer_company_id || null
      if (body.customer_company_id) {
        update.customer_person_id = null
      }
    }
    if (body.customer_company_name !== undefined) update.customer_company_name = body.customer_company_name || null
    if (body.customer_firstname !== undefined) update.customer_firstname = body.customer_firstname ?? null
    if (body.customer_lastname !== undefined) update.customer_lastname = body.customer_lastname ?? null
    if (body.customer_email !== undefined) update.customer_email = body.customer_email || null
    if (body.customer_phone !== undefined) update.customer_phone = body.customer_phone || null

    if (body.billing_firstname !== undefined) update.billing_firstname = body.billing_firstname
    if (body.billing_lastname !== undefined) update.billing_lastname = body.billing_lastname
    if (body.billing_company !== undefined) update.billing_company = body.billing_company
    if (body.billing_address1 !== undefined) update.billing_address1 = body.billing_address1
    if (body.billing_address2 !== undefined) update.billing_address2 = body.billing_address2
    if (body.billing_city !== undefined) update.billing_city = body.billing_city
    if (body.billing_postcode !== undefined) update.billing_postcode = body.billing_postcode
    if (body.billing_country_code !== undefined) update.billing_country_code = body.billing_country_code
    if (body.billing_tax_number !== undefined) update.billing_tax_number = body.billing_tax_number

    if (body.shipping_firstname !== undefined) update.shipping_firstname = body.shipping_firstname
    if (body.shipping_lastname !== undefined) update.shipping_lastname = body.shipping_lastname
    if (body.shipping_company !== undefined) update.shipping_company = body.shipping_company
    if (body.shipping_address1 !== undefined) update.shipping_address1 = body.shipping_address1
    if (body.shipping_address2 !== undefined) update.shipping_address2 = body.shipping_address2
    if (body.shipping_city !== undefined) update.shipping_city = body.shipping_city
    if (body.shipping_postcode !== undefined) update.shipping_postcode = body.shipping_postcode
    if (body.shipping_country_code !== undefined) update.shipping_country_code = body.shipping_country_code
    if (body.shipping_method_id !== undefined) update.shipping_method_id = body.shipping_method_id
    if (body.shipping_method_name !== undefined) update.shipping_method_name = body.shipping_method_name
    if (body.tracking_number !== undefined) update.tracking_number = body.tracking_number
    if (body.expected_delivery_date !== undefined) update.expected_delivery_date = body.expected_delivery_date

    if (body.payment_method_id !== undefined) update.payment_method_id = body.payment_method_id
    if (body.payment_method_name !== undefined) update.payment_method_name = body.payment_method_name
    if (body.payment_method_after !== undefined) update.payment_method_after = body.payment_method_after
    if (body.payment_status !== undefined) update.payment_status = body.payment_status

    if (body.status !== undefined) {
      const { data: currentOrder } = await supabase
        .from('orders')
        .select('status, stock_reserved')
        .eq('id', id)
        .is('deleted_at', null)
        .single()
      if (!currentOrder) {
        return NextResponse.json({ error: 'Rendelés nem található' }, { status: 404 })
      }
      const current = currentOrder.status as string
      const allowed = getAllowedNextStatus(current)
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          { error: `Állapotváltás nem engedélyezett: ${current} → ${body.status}` },
          { status: 400 }
        )
      }
      update.status = body.status
      previousStatusForEmail = current
      newStatusForEmail = body.status as string
      if (body.status === 'shipped') {
        update.shipped_at = new Date().toISOString()
      }
      // When moving to cancelled, release any reserved stock first (see docs/ORDER_RESERVATION_AND_DELETE.md)
      if (body.status === 'cancelled' && currentOrder.stock_reserved) {
        const releaseResult = await releaseReservedStockForOrder(supabase, id)
        if (!releaseResult.ok) {
          return NextResponse.json(
            { error: releaseResult.error || 'Nem sikerült felszabadítani a foglalt készletet' },
            { status: 500 }
          )
        }
        try {
          await supabase.rpc('refresh_stock_summary')
        } catch {
          // non-fatal
        }
      }
    }

    if (body.shipping_method_name !== undefined) update.shipping_method_name = body.shipping_method_name
    else if (update.shipping_method_id) {
      const { data: sm } = await supabase.from('shipping_methods').select('name').eq('id', update.shipping_method_id).single()
      if (sm?.name) update.shipping_method_name = sm.name
    }
    if (!update.payment_method_name && update.payment_method_id) {
      const { data: pm } = await supabase.from('payment_methods').select('name').eq('id', update.payment_method_id).single()
      if (pm?.name) update.payment_method_name = pm.name
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nincs frissítendő mező' }, { status: 400 })
    }

    const { data: order, error } = await supabase
      .from('orders')
      .update(update)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (!order) {
      return NextResponse.json({ error: 'Rendelés nem található' }, { status: 404 })
    }

    // When status was set to shipped or delivered, consume reserved stock and post outbound
    if (update.status === 'shipped' || update.status === 'delivered') {
      const consumeResult = await consumeReservedAndPostOutbound(supabase, id, { createdBy: user.id })
      if (!consumeResult.ok) {
        console.error('[orders PATCH] consume stock failed for order', id, consumeResult.error)
      }
      try {
        await supabase.rpc('refresh_stock_summary')
      } catch {
        // non-fatal
      }
    }

    if (newStatusForEmail) {
      await sendOrderStatusEmailNotification(supabase, {
        orderId: id,
        previousStatus: previousStatusForEmail,
        newStatus: newStatusForEmail,
        actingUserId: user.id
      })
    }

    return NextResponse.json({ order })
  } catch (error) {
    console.error('Error in orders PATCH API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/orders/[id]
 * Soft delete: set deleted_at, release reserved stock if any.
 * Allowed only for pending_review, new, cancelled, refunded. See docs/ORDER_RESERVATION_AND_DELETE.md.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('id, status, stock_reserved')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (fetchErr || !order) {
      return NextResponse.json({ error: 'Rendelés nem található' }, { status: 404 })
    }

    const status = order.status as string
    if (!canDeleteOrder(status)) {
      return NextResponse.json(
        { error: `A rendelés csak Áttekintésre vár, Új, Törölve vagy Visszatérítve állapotban távolítható el. Jelenlegi: ${status}` },
        { status: 400 }
      )
    }

    if (order.stock_reserved) {
      const releaseResult = await releaseReservedStockForOrder(supabase, id)
      if (!releaseResult.ok) {
        return NextResponse.json(
          { error: releaseResult.error || 'Nem sikerült felszabadítani a foglalt készletet' },
          { status: 500 }
        )
      }
      try {
        await supabase.rpc('refresh_stock_summary')
      } catch {
        // non-fatal
      }
    }

    const now = new Date().toISOString()
    const { error: updateErr } = await supabase
      .from('orders')
      .update({ deleted_at: now, updated_at: now })
      .eq('id', id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'Rendelés eltávolítva a listából' })
  } catch (error) {
    console.error('Error in orders DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
