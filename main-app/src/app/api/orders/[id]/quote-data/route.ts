import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getQuoteById } from '@/lib/supabase-server'

// GET - Get order quote data with pricing (for receipt printing)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    console.log(`[Receipt Print] Fetching order quote data for order ${id}`)

    // Orders ARE quotes, so use getQuoteById directly
    const quoteData = await getQuoteById(id)

    if (!quoteData) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Return only the data needed for receipt printing
    return NextResponse.json({
      id: quoteData.id,
      quote_number: quoteData.quote_number,
      order_number: quoteData.order_number,
      customer: quoteData.customer,
      pricing: quoteData.pricing || [],
      barcode: quoteData.barcode || null
    })

  } catch (error) {
    console.error('[Receipt Print] Error fetching order quote data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

