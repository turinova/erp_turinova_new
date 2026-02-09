import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// POST - Add payment to worktop quote/order
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

    const { id: worktopQuoteId } = await params
    const body = await request.json()
    const { amount, payment_method, comment } = body

    console.log('[ADD WORKTOP PAYMENT] Adding payment to worktop quote:', worktopQuoteId)
    console.time('[ADD WORKTOP PAYMENT] Total Time')

    // Validation
    if (amount === undefined || amount === null || isNaN(parseFloat(amount))) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 })
    }

    if (!payment_method) {
      return NextResponse.json({ error: 'Payment method is required' }, { status: 400 })
    }

    // Get current worktop quote to validate remaining balance
    const { data: quote, error: quoteError } = await supabase
      .from('worktop_quotes')
      .select('final_total_after_discount, order_number')
      .eq('id', worktopQuoteId)
      .single()

    if (quoteError || !quote) {
      console.error('[ADD WORKTOP PAYMENT] Worktop quote not found:', quoteError)
      return NextResponse.json({ error: 'Worktop quote not found' }, { status: 404 })
    }

    // Calculate current total paid
    const { data: payments } = await supabase
      .from('worktop_quote_payments')
      .select('amount')
      .eq('worktop_quote_id', worktopQuoteId)
      .is('deleted_at', null)

    // Round all values to nearest integer to avoid floating point precision issues
    // Round each payment amount first, then sum, to match client-side calculation
    const roundedTotalPaid = payments?.reduce((sum, p) => sum + Math.round(Number(p.amount)), 0) || 0
    const roundedFinalTotal = Math.round(quote.final_total_after_discount)
    const remainingBalance = roundedFinalTotal - roundedTotalPaid

    // Validate amount (positive amounts cannot exceed remaining balance, allow 1 Ft tolerance for rounding)
    const paymentAmount = Math.round(parseFloat(amount))
    if (paymentAmount > 0 && paymentAmount > remainingBalance + 1) {
      console.log('[ADD WORKTOP PAYMENT] Amount exceeds remaining balance by more than 1 Ft tolerance')
      // Format currency for display (round to integer)
      const formattedBalance = new Intl.NumberFormat('hu-HU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(remainingBalance)
      return NextResponse.json({ 
        error: `Az összeg nem lehet nagyobb, mint a hátralék (${formattedBalance} Ft)`,
        remaining_balance: remainingBalance
      }, { status: 400 })
    }

    // Insert payment
    console.time('[ADD WORKTOP PAYMENT] Insert Payment')
    const { data: newPayment, error: insertError } = await supabase
      .from('worktop_quote_payments')
      .insert({
        worktop_quote_id: worktopQuoteId,
        amount: paymentAmount,
        payment_method: payment_method,
        comment: comment || null,
        payment_date: new Date().toISOString(),
        created_by: user.id
      })
      .select()
      .single()

    if (insertError) {
      console.error('[ADD WORKTOP PAYMENT] Error inserting payment:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    console.timeEnd('[ADD WORKTOP PAYMENT] Insert Payment')
    console.log('[ADD WORKTOP PAYMENT] Payment added:', newPayment.id)

    // Payment status will be auto-updated by trigger
    console.timeEnd('[ADD WORKTOP PAYMENT] Total Time')
    console.log('[ADD WORKTOP PAYMENT] ✅ Payment added successfully')

    return NextResponse.json({
      success: true,
      payment: newPayment
    }, { status: 201 })

  } catch (error) {
    console.error('[ADD WORKTOP PAYMENT] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
