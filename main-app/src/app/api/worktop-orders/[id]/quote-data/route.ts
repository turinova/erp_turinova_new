import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getWorktopQuoteById } from '@/lib/supabase-server'

// GET - Get worktop order quote data with pricing (for receipt printing)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    console.log(`[Worktop Receipt Print] Fetching worktop order quote data for order ${id}`)

    const quoteData = await getWorktopQuoteById(id)

    if (!quoteData) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Return only the data needed for receipt printing
    return NextResponse.json({
      id: quoteData.id,
      quote_number: quoteData.quote_number,
      order_number: quoteData.order_number,
      customer: quoteData.customer,
      configs: quoteData.configs || [],
      pricing: quoteData.pricing || [],
      discount_percent: quoteData.discount_percent,
      total_net: quoteData.total_net,
      total_vat: quoteData.total_vat,
      total_gross: quoteData.total_gross,
      final_total_after_discount: quoteData.final_total_after_discount,
      barcode: quoteData.barcode || null
    })

  } catch (error) {
    console.error('[Worktop Receipt Print] Error fetching worktop order quote data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
