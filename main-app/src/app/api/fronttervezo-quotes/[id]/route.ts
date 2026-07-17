import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { recalculateFronttervezoQuoteTotals } from '@/lib/fronttervezo-quote-totals'
import { getFronttervezoQuoteById } from '@/lib/supabase-server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const quote = await getFronttervezoQuoteById(id)

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    return NextResponse.json(quote)
  } catch (error) {
    console.error('[fronttervezo-quotes GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quoteId } = await params
    const body = await request.json()
    const { discount_percent } = body

    if (discount_percent === undefined || discount_percent === null) {
      return NextResponse.json({ error: 'discount_percent is required' }, { status: 400 })
    }

    if (discount_percent < 0 || discount_percent > 100) {
      return NextResponse.json(
        { error: 'discount_percent must be between 0 and 100' },
        { status: 400 }
      )
    }

    const { data: quote } = await supabase
      .from('fronttervezo_quotes')
      .select('customer_id, status')
      .eq('id', quoteId)
      .is('deleted_at', null)
      .single()

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    if (['ready', 'finished'].includes(quote.status)) {
      return NextResponse.json({ error: 'Ez a státusz nem szerkeszthető' }, { status: 400 })
    }

    const { error } = await supabase
      .from('fronttervezo_quotes')
      .update({
        discount_percent,
        updated_at: new Date().toISOString()
      })
      .eq('id', quoteId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase
      .from('customers')
      .update({ discount_percent })
      .eq('id', quote.customer_id)

    await recalculateFronttervezoQuoteTotals(quoteId)

    return NextResponse.json({ success: true, discount_percent })
  } catch (error) {
    console.error('[fronttervezo-quotes PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
