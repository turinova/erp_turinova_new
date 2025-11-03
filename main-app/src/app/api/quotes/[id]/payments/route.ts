import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// POST - Add payment to quote/order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: quoteId } = await params
    const body = await request.json()
    const { amount, payment_method, comment } = body

    console.log('[ADD PAYMENT] Adding payment to quote:', quoteId)
    console.time('[ADD PAYMENT] Total Time')

    // Validation
    if (amount === undefined || amount === null || isNaN(parseFloat(amount))) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 })
    }

    if (!payment_method) {
      return NextResponse.json({ error: 'Payment method is required' }, { status: 400 })
    }

    // Get current quote to validate remaining balance
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('final_total_after_discount, order_number')
      .eq('id', quoteId)
      .single()

    if (quoteError || !quote) {
      console.error('[ADD PAYMENT] Quote not found:', quoteError)
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Calculate current total paid
    const { data: payments } = await supabase
      .from('quote_payments')
      .select('amount')
      .eq('quote_id', quoteId)
      .is('deleted_at', null)

    const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
    const remainingBalance = quote.final_total_after_discount - totalPaid

    // Validate amount (positive amounts cannot exceed remaining balance, allow 1 Ft tolerance for rounding)
    const paymentAmount = parseFloat(amount)
    if (paymentAmount > 0 && paymentAmount > remainingBalance + 1) {
      console.log('[ADD PAYMENT] Amount exceeds remaining balance by more than 1 Ft tolerance')
      return NextResponse.json({ 
        error: `Az összeg nem lehet nagyobb, mint a hátralék (${remainingBalance} Ft)`,
        remaining_balance: remainingBalance
      }, { status: 400 })
    }

    // Insert payment
    console.time('[ADD PAYMENT] Insert Payment')
    const { data: newPayment, error: insertError } = await supabase
      .from('quote_payments')
      .insert({
        quote_id: quoteId,
        amount: paymentAmount,
        payment_method: payment_method,
        comment: comment || null,
        payment_date: new Date().toISOString(),
        created_by: user.id
      })
      .select()
      .single()

    if (insertError) {
      console.error('[ADD PAYMENT] Error inserting payment:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    console.timeEnd('[ADD PAYMENT] Insert Payment')
    console.log('[ADD PAYMENT] Payment added:', newPayment.id)

    // Payment status will be auto-updated by trigger
    console.timeEnd('[ADD PAYMENT] Total Time')
    console.log('[ADD PAYMENT] ✅ Payment added successfully')

    return NextResponse.json({
      success: true,
      payment: newPayment
    }, { status: 201 })

  } catch (error) {
    console.error('[ADD PAYMENT] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

