import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { supabaseServer } from '@/lib/supabase-server'

/** POST — fizetés hozzáadása fronttervezo megrendeléshez */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const { id: quoteId } = await params
    const body = await request.json()
    const { amount, payment_method, comment } = body

    if (amount === undefined || amount === null || isNaN(parseFloat(amount))) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 })
    }

    if (!payment_method) {
      return NextResponse.json({ error: 'Payment method is required' }, { status: 400 })
    }

    const { data: quote, error: quoteError } = await supabaseServer
      .from('fronttervezo_quotes')
      .select('id, status, final_total_after_discount, order_number')
      .eq('id', quoteId)
      .is('deleted_at', null)
      .maybeSingle()

    if (quoteError || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    if (quote.status === 'draft') {
      return NextResponse.json(
        { error: 'Piszkozatra nem lehet fizetést rögzíteni' },
        { status: 400 }
      )
    }

    const { data: payments } = await supabaseServer
      .from('fronttervezo_quote_payments')
      .select('amount')
      .eq('quote_id', quoteId)
      .is('deleted_at', null)

    const roundedFinalTotal = Math.round(Number(quote.final_total_after_discount) || 0)
    const roundedTotalPaid = Math.round(
      payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
    )
    const remainingBalance = roundedFinalTotal - roundedTotalPaid
    const paymentAmount = Math.round(parseFloat(amount))

    if (paymentAmount > 0 && paymentAmount > remainingBalance + 1) {
      const formattedBalance = new Intl.NumberFormat('hu-HU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(remainingBalance)

      return NextResponse.json(
        {
          error: `Az összeg nem lehet nagyobb, mint a hátralék (${formattedBalance} Ft)`,
          remaining_balance: remainingBalance
        },
        { status: 400 }
      )
    }

    const { data: newPayment, error: insertError } = await supabaseServer
      .from('fronttervezo_quote_payments')
      .insert({
        quote_id: quoteId,
        amount: paymentAmount,
        payment_method,
        comment: comment || null,
        payment_date: new Date().toISOString(),
        created_by: user.id
      })
      .select()
      .single()

    if (insertError) {
      console.error('[FT ADD PAYMENT]', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, payment: newPayment }, { status: 201 })
  } catch (error) {
    console.error('[FT ADD PAYMENT]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
