import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { sendOrderReadySMS } from '@/lib/twilio'

/**
 * PATCH /api/orders/bulk-status
 * Update multiple orders' status at once (with optional payment creation and SMS notifications)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { order_ids, new_status, create_payments = false, sms_order_ids = [] } = body

    // Validation
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

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch orders with customer data for SMS (BEFORE status update)
    // Only fetch orders that are in the sms_order_ids list (user confirmed in modal)
    let ordersForSMS: any[] = []
    if (new_status === 'ready' && sms_order_ids.length > 0) {
      const { data: orders, error: ordersError } = await supabase
        .from('quotes')
        .select(`
          id,
          quote_number,
          order_number,
          status,
          customer_id,
          customers!inner (
            id,
            name,
            mobile,
            sms_notification
          )
        `)
        .in('id', sms_order_ids)  // Only fetch user-confirmed orders
        .eq('status', 'in_production')  // Only get orders currently in production

      if (!ordersError && orders) {
        ordersForSMS = orders.filter(order => 
          order.customers?.sms_notification === true && 
          order.customers?.mobile
        )
        console.log(`[SMS] Found ${ordersForSMS.length} orders to send SMS (${sms_order_ids.length} selected by user)`)
      }
    }

    let paymentsCreated = 0

    // If create_payments is true, create payments for orders with remaining balance
    if (create_payments) {
      // Fetch orders with their payment details
      const { data: orders, error: ordersError } = await supabase
        .from('quotes')
        .select(`
          id,
          final_total_after_discount,
          payment_status
        `)
        .in('id', order_ids)

      if (ordersError) {
        console.error('Error fetching orders for payment:', ordersError)
        return NextResponse.json(
          { error: 'Hiba történt a megrendelések lekérdezése során' },
          { status: 500 }
        )
      }

      // Get total paid for each order
      const { data: paymentSums, error: paymentsError } = await supabase
        .from('quote_payments')
        .select('quote_id, amount')
        .in('quote_id', order_ids)

      if (paymentsError) {
        console.error('Error fetching payment sums:', paymentsError)
      }

      // Calculate total paid per order
      const paidByOrder = (paymentSums || []).reduce((acc, p) => {
        acc[p.quote_id] = (acc[p.quote_id] || 0) + p.amount
        return acc
      }, {} as Record<string, number>)

      // Get last payment method for each order
      const { data: lastPayments, error: lastPaymentsError } = await supabase
        .from('quote_payments')
        .select('quote_id, payment_method')
        .in('quote_id', order_ids)
        .order('payment_date', { ascending: false })

      if (lastPaymentsError) {
        console.error('Error fetching last payments:', lastPaymentsError)
      }

      const lastMethodByOrder = (lastPayments || []).reduce((acc, p) => {
        if (!acc[p.quote_id]) {
          acc[p.quote_id] = p.payment_method
        }
        return acc
      }, {} as Record<string, string>)

      // Create payments for orders with remaining balance
      const paymentsToCreate = []
      for (const order of orders || []) {
        const totalPaid = paidByOrder[order.id] || 0
        const remainingBalance = order.final_total_after_discount - totalPaid

        // Skip if already paid or no remaining balance
        if (order.payment_status === 'paid' || remainingBalance <= 0) {
          continue
        }

        paymentsToCreate.push({
          quote_id: order.id,
          amount: remainingBalance,
          payment_method: lastMethodByOrder[order.id] || 'cash', // Default to 'cash' if no previous payment
          payment_date: new Date().toISOString(),
          comment: 'Automata fizetés',
          created_by: user.id
        })
      }

      // Insert payments if any
      if (paymentsToCreate.length > 0) {
        const { data: createdPayments, error: createError } = await supabase
          .from('quote_payments')
          .insert(paymentsToCreate)
          .select('id')

        if (createError) {
          console.error('Error creating payments:', createError)
          return NextResponse.json(
            { error: 'Hiba történt a fizetések rögzítése során', details: createError.message },
            { status: 500 }
          )
        }

        paymentsCreated = createdPayments?.length || 0
      }
    }

    // Prepare update data
    const updateData: any = {
      status: new_status,
      updated_at: new Date().toISOString()
    }

    // If setting to cancelled, also clear production data
    if (new_status === 'cancelled') {
      updateData.production_machine_id = null
      updateData.production_date = null
      updateData.barcode = null
    }

    // Update all selected orders status
    const { data, error } = await supabase
      .from('quotes')
      .update(updateData)
      .in('id', order_ids)
      .select('id')

    if (error) {
      console.error('Bulk status update error:', error)
      
      // If we created payments but status update failed, we should rollback
      // This is handled by the database trigger for payment_status
      return NextResponse.json(
        { error: 'Hiba történt a frissítés során', details: error.message },
        { status: 500 }
      )
    }

    // Send SMS notifications AFTER successful status update
    const smsResults = {
      sent: 0,
      failed: 0,
      errors: [] as string[]
    }

    if (new_status === 'ready' && ordersForSMS.length > 0) {
      console.log(`[SMS] Sending ${ordersForSMS.length} SMS notifications...`)
      
      for (const order of ordersForSMS) {
        const result = await sendOrderReadySMS(
          order.customers.name,
          order.customers.mobile,
          order.order_number || order.quote_number,
          'Turinova'
        )

        if (result.success) {
          smsResults.sent++
          console.log(`[SMS] ✓ Sent to ${order.customers.name} (${order.customers.mobile})`)
        } else {
          smsResults.failed++
          smsResults.errors.push(`${order.customers.name}: ${result.error}`)
          console.error(`[SMS] ✗ Failed for ${order.customers.name}:`, result.error)
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
    console.error('Bulk status update error:', error)
    return NextResponse.json(
      { error: 'Hiba történt a frissítés során' },
      { status: 500 }
    )
  }
}

