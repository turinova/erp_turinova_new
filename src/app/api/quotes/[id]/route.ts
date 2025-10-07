import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getQuoteById } from '@/lib/supabase-server'

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

