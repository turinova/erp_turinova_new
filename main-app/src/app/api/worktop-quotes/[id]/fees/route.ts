import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// GET all fees for a worktop quote
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data: fees, error } = await supabase
      .from('worktop_quote_fees')
      .select(`
        *,
        feetypes (
          id,
          name
        ),
        currencies (
          id,
          name
        )
      `)
      .eq('worktop_quote_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching worktop quote fees:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(fees || [])
  } catch (error) {
    console.error('Error in GET /api/worktop-quotes/[id]/fees:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Add a fee to a worktop quote
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: worktopQuoteId } = await params
    const body = await request.json()
    const { feetype_id, quantity = 1, unit_price_net, comment = '' } = body

    if (!feetype_id) {
      return NextResponse.json(
        { error: 'feetype_id is required' },
        { status: 400 }
      )
    }

    if (quantity < 1) {
      return NextResponse.json(
        { error: 'quantity must be at least 1' },
        { status: 400 }
      )
    }

    // Fetch fee type details
    const { data: feeType, error: feeError } = await supabase
      .from('feetypes')
      .select(`
        *,
        vat (kulcs),
        currencies (id, name)
      `)
      .eq('id', feetype_id)
      .is('deleted_at', null)
      .single()

    if (feeError || !feeType) {
      return NextResponse.json(
        { error: 'Fee type not found' },
        { status: 404 }
      )
    }

    // Use provided unit price or default from fee type
    const finalUnitPrice = unit_price_net !== undefined ? unit_price_net : feeType.net_price
    
    // Calculate totals with quantity
    const vatRate = (feeType.vat?.kulcs || 0) / 100
    const totalNet = finalUnitPrice * quantity
    const totalVat = totalNet * vatRate
    const totalGross = totalNet + totalVat

    // Insert fee
    const { data: newFee, error: insertError } = await supabase
      .from('worktop_quote_fees')
      .insert({
        worktop_quote_id: worktopQuoteId,
        feetype_id: feetype_id,
        fee_name: feeType.name,
        quantity: quantity,
        unit_price_net: finalUnitPrice,
        vat_rate: vatRate,
        vat_amount: totalVat,
        gross_price: totalGross,
        currency_id: feeType.currency_id,
        comment: comment
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting worktop quote fee:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Recalculate worktop quote totals
    await recalculateWorktopQuoteTotals(worktopQuoteId)

    return NextResponse.json(newFee, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/worktop-quotes/[id]/fees:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to recalculate worktop quote totals
async function recalculateWorktopQuoteTotals(worktopQuoteId: string) {
  // Get all fees
  const { data: fees } = await supabase
    .from('worktop_quote_fees')
    .select('unit_price_net, quantity, vat_rate, vat_amount, gross_price')
    .eq('worktop_quote_id', worktopQuoteId)
    .is('deleted_at', null)

  // Calculate totals (fees with quantity support)
  const feesTotalNet = fees?.reduce((sum, f) => {
    const totalNet = Number(f.unit_price_net) * Number(f.quantity || 1)
    return sum + totalNet
  }, 0) || 0
  
  const feesTotalVat = fees?.reduce((sum, f) => {
    const totalNet = Number(f.unit_price_net) * Number(f.quantity || 1)
    const totalVat = totalNet * Number(f.vat_rate)
    return sum + totalVat
  }, 0) || 0
  
  const feesTotalGross = feesTotalNet + feesTotalVat

  // Get current worktop quote to calculate final total with discount
  const { data: worktopQuote } = await supabase
    .from('worktop_quotes')
    .select('total_net, total_vat, total_gross, discount_percent')
    .eq('id', worktopQuoteId)
    .single()

  if (worktopQuote) {
    const discountPercent = Number(worktopQuote.discount_percent) / 100
    
    // Calculate subtotal (before discount) - only positive values
    const materialsGross = Number(worktopQuote.total_gross)
    const feesGrossPositive = Math.max(0, feesTotalGross) // Only positive fees get discount
    
    const subtotalBeforeDiscount = materialsGross + feesGrossPositive
    
    // Calculate discount amount (only on positive values)
    const discountAmount = subtotalBeforeDiscount * discountPercent
    
    // Add negative fees (no discount on these)
    const feesNegative = Math.min(0, feesTotalGross)
    
    // Final total = (positive values with discount) + (negative values without discount)
    const finalTotalGross = subtotalBeforeDiscount - discountAmount + feesNegative

    // Update worktop quote
    await supabase
      .from('worktop_quotes')
      .update({
        fees_total_net: feesTotalNet,
        fees_total_vat: feesTotalVat,
        fees_total_gross: feesTotalGross,
        final_total_after_discount: finalTotalGross
      })
      .eq('id', worktopQuoteId)
  }
}

export { recalculateWorktopQuoteTotals }
