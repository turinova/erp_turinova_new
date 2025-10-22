import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getQuoteById } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { recalculateQuoteTotals } from './fees/route'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// GET - Get single quote with all data
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    console.log(`Fetching quote ${id}`)

    // Use the centralized getQuoteById function that includes all data
    const quote = await getQuoteById(id)

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    console.log(`Quote fetched successfully: ${quote.quote_number} with ${quote.panels?.length || 0} panels`)
    
    return NextResponse.json(quote)

  } catch (error) {
    console.error('Error fetching quote:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update quote discount percentage
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
      .from('quotes')
      .select('customer_id')
      .eq('id', quoteId)
      .single()

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Update quote discount
    const { error } = await supabase
      .from('quotes')
      .update({ discount_percent: discount_percent })
      .eq('id', quoteId)

    if (error) {
      console.error('Error updating quote discount:', error)
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

    // Recalculate totals with new discount
    await recalculateQuoteTotals(quoteId)

    return NextResponse.json({ success: true, discount_percent })

  } catch (error) {
    console.error('Error in PATCH /api/quotes/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

