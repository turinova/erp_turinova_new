import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { supabaseServer } from '@/lib/supabase-server'

/**
 * POST — draft fronttervezo quote → order
 * Auth: cookie session. DB: service role (fronttervezo_quotes RLS még nincs authenticated policy).
 */
export async function POST(request: Request) {
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

    const body = await request.json()
    const { quote_id, initial_payment, expected_arrival_date } = body

    if (!quote_id) {
      return NextResponse.json({ error: 'Quote ID required' }, { status: 400 })
    }

    if (!expected_arrival_date || typeof expected_arrival_date !== 'string') {
      return NextResponse.json(
        { error: 'Várható szállítási dátum kötelező' },
        { status: 400 }
      )
    }

    const arrivalDate = expected_arrival_date.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(arrivalDate)) {
      return NextResponse.json(
        { error: 'Érvénytelen várható szállítási dátum' },
        { status: 400 }
      )
    }

    const { data: existingQuote, error: fetchError } = await supabaseServer
      .from('fronttervezo_quotes')
      .select('id, status, barcode, deleted_at')
      .eq('id', quote_id)
      .is('deleted_at', null)
      .maybeSingle()

    if (fetchError) {
      console.error('[FT ORDER CREATE] fetch:', fetchError)
      return NextResponse.json(
        { error: 'Az ajánlat lekérdezése sikertelen', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!existingQuote) {
      return NextResponse.json({ error: 'Az ajánlat nem található' }, { status: 404 })
    }

    if (existingQuote.status !== 'draft') {
      return NextResponse.json(
        { error: 'Csak piszkozat státuszú ajánlatból lehet megrendelést létrehozni' },
        { status: 400 }
      )
    }

    const { data: orderNumber, error: orderNumberError } = await supabaseServer.rpc(
      'generate_fronttervezo_order_number'
    )

    if (orderNumberError || !orderNumber) {
      console.error('[FT ORDER CREATE] order number:', orderNumberError)
      return NextResponse.json(
        {
          error: 'Failed to generate order number',
          details: orderNumberError?.message
        },
        { status: 500 }
      )
    }

    let barcode: string | null = existingQuote.barcode || null

    if (!barcode) {
      const { data: generatedBarcode, error: barcodeError } = await supabaseServer.rpc(
        'generate_fronttervezo_order_barcode'
      )

      if (barcodeError || !generatedBarcode) {
        console.error('[FT ORDER CREATE] barcode:', barcodeError)
        return NextResponse.json(
          {
            error: 'Failed to generate barcode',
            details: barcodeError?.message || 'Unknown error'
          },
          { status: 500 }
        )
      }
      barcode = generatedBarcode
    }

    const { data: updatedQuote, error: updateError } = await supabaseServer
      .from('fronttervezo_quotes')
      .update({
        status: 'ordered',
        order_number: orderNumber,
        barcode,
        expected_arrival_date: arrivalDate,
        payment_status: 'not_paid',
        updated_at: new Date().toISOString()
      })
      .eq('id', quote_id)
      .eq('status', 'draft')
      .is('deleted_at', null)
      .select('id, order_number, barcode, status, expected_arrival_date')
      .maybeSingle()

    if (updateError) {
      console.error('[FT ORDER CREATE] update:', updateError)
      return NextResponse.json(
        {
          error: 'Failed to convert quote to order',
          details: updateError.message,
          code: updateError.code
        },
        { status: 500 }
      )
    }

    if (!updatedQuote) {
      return NextResponse.json(
        { error: 'Failed to convert quote to order', details: 'No rows updated' },
        { status: 500 }
      )
    }

    if (initial_payment && parseFloat(initial_payment.amount) > 0) {
      const { error: paymentError } = await supabaseServer.from('fronttervezo_quote_payments').insert({
        quote_id,
        amount: parseFloat(initial_payment.amount),
        payment_method: initial_payment.payment_method || 'cash',
        comment: initial_payment.comment || null,
        payment_date: new Date().toISOString(),
        created_by: user.id
      })

      if (paymentError) {
        console.error('[FT ORDER CREATE] payment:', paymentError)
      }
    }

    return NextResponse.json({
      success: true,
      quote_id,
      order_number: orderNumber,
      barcode,
      status: 'ordered',
      expected_arrival_date: arrivalDate
    })
  } catch (error) {
    console.error('[FT ORDER CREATE]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
