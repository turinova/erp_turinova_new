import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { recalculateFronttervezoQuoteTotals } from '@/lib/fronttervezo-quote-totals'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data: fees, error } = await supabase
      .from('fronttervezo_quote_fees')
      .select(
        `
        *,
        feetypes (id, name),
        currencies (id, name)
      `
      )
      .eq('quote_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(fees || [])
  } catch (error) {
    console.error('[fronttervezo fees GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quoteId } = await params
    const body = await request.json()
    const { feetype_id, quantity = 1, unit_price_net, comment = '' } = body

    if (!feetype_id) {
      return NextResponse.json({ error: 'feetype_id is required' }, { status: 400 })
    }

    if (quantity < 1) {
      return NextResponse.json({ error: 'quantity must be at least 1' }, { status: 400 })
    }

    const { data: feeType, error: feeError } = await supabase
      .from('feetypes')
      .select(`*, vat (kulcs), currencies (id, name)`)
      .eq('id', feetype_id)
      .is('deleted_at', null)
      .single()

    if (feeError || !feeType) {
      return NextResponse.json({ error: 'Fee type not found' }, { status: 404 })
    }

    const finalUnitPrice = unit_price_net !== undefined ? unit_price_net : feeType.net_price
    const vatRate = (feeType.vat?.kulcs || 0) / 100
    const totalNet = finalUnitPrice * quantity
    const totalVat = totalNet * vatRate
    const totalGross = totalNet + totalVat

    const { data: newFee, error: insertError } = await supabase
      .from('fronttervezo_quote_fees')
      .insert({
        quote_id: quoteId,
        feetype_id,
        fee_name: feeType.name,
        quantity,
        unit_price_net: finalUnitPrice,
        vat_rate: vatRate,
        vat_amount: totalVat,
        gross_price: totalGross,
        currency_id: feeType.currency_id,
        comment
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    await recalculateFronttervezoQuoteTotals(quoteId)

    return NextResponse.json(newFee, { status: 201 })
  } catch (error) {
    console.error('[fronttervezo fees POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
