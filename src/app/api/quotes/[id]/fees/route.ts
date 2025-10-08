import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// GET all fees for a quote
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data: fees, error } = await supabase
      .from('quote_fees')
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
      .eq('quote_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching quote fees:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(fees || [])
  } catch (error) {
    console.error('Error in GET /api/quotes/[id]/fees:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Add a fee to a quote
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quoteId } = await params
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
      .from('quote_fees')
      .insert({
        quote_id: quoteId,
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
      console.error('Error inserting fee:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Recalculate quote totals
    await recalculateQuoteTotals(quoteId)

    return NextResponse.json(newFee, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/quotes/[id]/fees:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to recalculate quote totals
async function recalculateQuoteTotals(quoteId: string) {
  // Get all fees
  const { data: fees } = await supabase
    .from('quote_fees')
    .select('unit_price_net, quantity, vat_rate, vat_amount, gross_price')
    .eq('quote_id', quoteId)
    .is('deleted_at', null)

  // Get all accessories
  const { data: accessories } = await supabase
    .from('quote_accessories')
    .select('total_net, total_vat, total_gross')
    .eq('quote_id', quoteId)
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

  const accessoriesTotalNet = accessories?.reduce((sum, a) => sum + Number(a.total_net), 0) || 0
  const accessoriesTotalVat = accessories?.reduce((sum, a) => sum + Number(a.total_vat), 0) || 0
  const accessoriesTotalGross = accessories?.reduce((sum, a) => sum + Number(a.total_gross), 0) || 0

  // Get current quote to calculate final total with discount
  const { data: quote } = await supabase
    .from('quotes')
    .select('total_net, total_vat, total_gross, discount_percent')
    .eq('id', quoteId)
    .single()

  if (quote) {
    const discountPercent = Number(quote.discount_percent) / 100
    
    // Calculate subtotal (before discount) - only positive values
    const materialsGross = Number(quote.total_gross)
    const feesGrossPositive = Math.max(0, feesTotalGross) // Only positive fees get discount
    const accessoriesGrossPositive = Math.max(0, accessoriesTotalGross) // Only positive accessories get discount
    
    const subtotalBeforeDiscount = materialsGross + feesGrossPositive + accessoriesGrossPositive
    
    // Calculate discount amount (only on positive values)
    const discountAmount = subtotalBeforeDiscount * discountPercent
    
    // Add negative fees/accessories (no discount on these)
    const feesNegative = Math.min(0, feesTotalGross)
    const accessoriesNegative = Math.min(0, accessoriesTotalGross)
    
    // Final total = (positive values with discount) + (negative values without discount)
    const finalTotalGross = subtotalBeforeDiscount - discountAmount + feesNegative + accessoriesNegative

    // Update quote
    await supabase
      .from('quotes')
      .update({
        fees_total_net: feesTotalNet,
        fees_total_vat: feesTotalVat,
        fees_total_gross: feesTotalGross,
        accessories_total_net: accessoriesTotalNet,
        accessories_total_vat: accessoriesTotalVat,
        accessories_total_gross: accessoriesTotalGross,
        final_total_after_discount: finalTotalGross
      })
      .eq('id', quoteId)
  }
}

export { recalculateQuoteTotals }

