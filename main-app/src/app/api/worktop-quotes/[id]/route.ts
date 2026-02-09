import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// GET - Get single worktop quote with all data
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    console.log(`Fetching worktop quote ${id}`)

    // Fetch worktop quote with related data
    const { data: quote, error: quoteError } = await supabase
      .from('worktop_quotes')
      .select(`
        *,
        customers (*),
        configs:worktop_quote_configs (*),
        pricing:worktop_quote_materials_pricing (*),
        payments:worktop_quote_payments (*)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (quoteError || !quote) {
      console.error('Error fetching worktop quote:', quoteError)
      return NextResponse.json({ error: 'Worktop quote not found' }, { status: 404 })
    }

    console.log(`Worktop quote fetched successfully: ${quote.quote_number} with ${quote.configs?.length || 0} configs`)
    
    return NextResponse.json(quote)

  } catch (error) {
    console.error('Error fetching worktop quote:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update worktop quote discount percentage
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: quoteId } = await params
    const body = await request.json()
    const { discount_percent } = body

    if (discount_percent === undefined || discount_percent === null) {
      return NextResponse.json({ error: 'discount_percent is required' }, { status: 400 })
    }

    if (discount_percent < 0 || discount_percent > 100) {
      return NextResponse.json({ error: 'discount_percent must be between 0 and 100' }, { status: 400 })
    }

    // Get customer_id from quote
    const { data: quote } = await supabase
      .from('worktop_quotes')
      .select('customer_id, total_gross')
      .eq('id', quoteId)
      .single()

    if (!quote) {
      return NextResponse.json({ error: 'Worktop quote not found' }, { status: 404 })
    }

    // Calculate final total with new discount
    const totalGross = Number(quote.total_gross)
    const finalTotalAfterDiscount = totalGross * (1 - discount_percent / 100)

    // Update worktop quote discount
    const { error } = await supabase
      .from('worktop_quotes')
      .update({ 
        discount_percent: discount_percent,
        final_total_after_discount: finalTotalAfterDiscount
      })
      .eq('id', quoteId)

    if (error) {
      console.error('Error updating worktop quote discount:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Also update customer's default discount
    const { error: customerError } = await supabase
      .from('customers')
      .update({ discount_percent: discount_percent })
      .eq('id', quote.customer_id)

    if (customerError) {
      console.error('Error updating customer discount:', customerError)
      // Continue anyway - quote discount is updated
    }

    return NextResponse.json({ success: true, discount_percent })

  } catch (error) {
    console.error('Error in PATCH /api/worktop-quotes/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
