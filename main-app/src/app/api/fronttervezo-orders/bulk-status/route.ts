import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

import { supabaseServer } from '@/lib/supabase-server'
import { sendFronttervezoReadySMS } from '@/lib/twilio'

/**
 * PATCH /api/fronttervezo-orders/bulk-status
 * new_status: ready | finished | cancelled
 * ready → actual_arrival_date + opcionális SMS (sms_order_ids)
 * finished → create_payments opcionális (POS később)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      order_ids,
      new_status,
      create_payments = false,
      actual_arrival_date,
      sms_order_ids = []
    } = body

    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return NextResponse.json(
        { error: 'Legalább egy megrendelés ID szükséges' },
        { status: 400 }
      )
    }

    if (!new_status || !['ready', 'finished', 'cancelled'].includes(new_status)) {
      return NextResponse.json(
        { error: 'Érvénytelen státusz (csak ready, finished vagy cancelled)' },
        { status: 400 }
      )
    }

    if (new_status === 'ready') {
      if (!actual_arrival_date || typeof actual_arrival_date !== 'string') {
        return NextResponse.json(
          { error: 'Beérkezés dátuma kötelező' },
          { status: 400 }
        )
      }
      const arrivalDateCheck = actual_arrival_date.slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(arrivalDateCheck)) {
        return NextResponse.json(
          { error: 'Érvénytelen beérkezés dátum' },
          { status: 400 }
        )
      }
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

    const arrivalDate =
      new_status === 'ready' ? String(actual_arrival_date).slice(0, 10) : null

    // Prefetch SMS targets before status update
    type SmsTarget = {
      id: string
      order_number: string | null
      quote_number: string
      final_total_after_discount: number
      customers: { name: string; mobile: string; sms_notification: boolean } | null
    }
    let ordersForSMS: SmsTarget[] = []

    if (
      new_status === 'ready' &&
      Array.isArray(sms_order_ids) &&
      sms_order_ids.length > 0
    ) {
      const { data: smsOrders, error: smsFetchError } = await supabaseServer
        .from('fronttervezo_quotes')
        .select(
          `
          id,
          quote_number,
          order_number,
          final_total_after_discount,
          customers!inner (
            id,
            name,
            mobile,
            sms_notification
          )
        `
        )
        .in('id', sms_order_ids)
        .is('deleted_at', null)

      if (smsFetchError) {
        console.error('[FT bulk-status] SMS fetch:', smsFetchError)
      } else {
        ordersForSMS = (smsOrders || [])
          .map(o => ({
            id: o.id,
            order_number: o.order_number,
            quote_number: o.quote_number,
            final_total_after_discount: Number(o.final_total_after_discount) || 0,
            customers: o.customers as SmsTarget['customers']
          }))
          .filter(
            o =>
              o.customers?.sms_notification === true &&
              o.customers?.mobile &&
              o.customers.mobile.trim().length > 0
          )
      }
    }

    let paymentsCreated = 0

    if (new_status === 'finished' && create_payments) {
      const { data: orders, error: ordersError } = await supabaseServer
        .from('fronttervezo_quotes')
        .select('id, final_total_after_discount, payment_status')
        .in('id', order_ids)
        .is('deleted_at', null)

      if (ordersError) {
        return NextResponse.json(
          { error: 'Hiba történt a megrendelések lekérdezése során' },
          { status: 500 }
        )
      }

      const { data: paymentSums } = await supabaseServer
        .from('fronttervezo_quote_payments')
        .select('quote_id, amount')
        .in('quote_id', order_ids)
        .is('deleted_at', null)

      const paidByOrder = (paymentSums || []).reduce(
        (acc: Record<string, number>, p: { quote_id: string; amount: number }) => {
          acc[p.quote_id] = (acc[p.quote_id] || 0) + Number(p.amount)
          return acc
        },
        {}
      )

      const { data: lastPayments } = await supabaseServer
        .from('fronttervezo_quote_payments')
        .select('quote_id, payment_method')
        .in('quote_id', order_ids)
        .is('deleted_at', null)
        .order('payment_date', { ascending: false })

      const lastMethodByOrder = (lastPayments || []).reduce(
        (acc: Record<string, string>, p: { quote_id: string; payment_method: string }) => {
          if (!acc[p.quote_id]) acc[p.quote_id] = p.payment_method
          return acc
        },
        {}
      )

      const paymentsToCreate: Array<{
        quote_id: string
        amount: number
        payment_method: string
        payment_date: string
        comment: string
        created_by: string
      }> = []

      for (const order of orders || []) {
        const totalPaid = paidByOrder[order.id] || 0
        const remainingBalance =
          Math.round(Number(order.final_total_after_discount) || 0) - Math.round(totalPaid)

        if (order.payment_status === 'paid' || remainingBalance <= 0) continue

        paymentsToCreate.push({
          quote_id: order.id,
          amount: remainingBalance,
          payment_method: lastMethodByOrder[order.id] || 'cash',
          payment_date: new Date().toISOString(),
          comment: 'Automata fizetés',
          created_by: user.id
        })
      }

      if (paymentsToCreate.length > 0) {
        const { data: created, error: createError } = await supabaseServer
          .from('fronttervezo_quote_payments')
          .insert(paymentsToCreate)
          .select('id')

        if (createError) {
          return NextResponse.json(
            { error: 'Hiba történt a fizetések rögzítése során', details: createError.message },
            { status: 500 }
          )
        }
        paymentsCreated = created?.length || 0
      }
    }

    const updateData: Record<string, unknown> = {
      status: new_status,
      updated_at: new Date().toISOString()
    }

    if (new_status === 'ready' && arrivalDate) {
      updateData.actual_arrival_date = arrivalDate
    }

    const { data, error } = await supabaseServer
      .from('fronttervezo_quotes')
      .update(updateData)
      .in('id', order_ids)
      .is('deleted_at', null)
      .select('id')

    if (error) {
      console.error('[FT bulk-status]', error)
      return NextResponse.json(
        { error: 'Hiba történt a frissítés során', details: error.message },
        { status: 500 }
      )
    }

    const smsResults = { sent: 0, failed: 0, errors: [] as string[] }

    if (new_status === 'ready' && ordersForSMS.length > 0) {
      let companyName = 'Turinova'
      try {
        const { data: companyData } = await supabaseServer
          .from('tenant_company')
          .select('name')
          .limit(1)
          .single()
        if (companyData?.name) companyName = companyData.name
      } catch {
        // fallback
      }

      for (const order of ordersForSMS) {
        if (!order.customers) continue

        const result = await sendFronttervezoReadySMS(
          order.customers.name,
          order.customers.mobile,
          order.order_number || order.quote_number,
          order.final_total_after_discount,
          companyName,
          arrivalDate
        )

        if (result.success) {
          smsResults.sent++
          await supabaseServer
            .from('fronttervezo_quotes')
            .update({ ready_notification_sent_at: new Date().toISOString() })
            .eq('id', order.id)
        } else {
          smsResults.failed++
          if (result.error) smsResults.errors.push(result.error)
        }
      }
    }

    return NextResponse.json({
      success: true,
      updated_count: data?.length || 0,
      payments_created: paymentsCreated,
      new_status,
      sms_notifications: smsResults
    })
  } catch (error) {
    console.error('[FT bulk-status]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
