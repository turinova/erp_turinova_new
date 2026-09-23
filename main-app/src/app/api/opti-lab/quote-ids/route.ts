import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * GET /api/opti-lab/quote-ids
 * Paginated quote IDs that have panels — for full-set Lab runs.
 * Query: page (0-based), page_size (default 200, max 500)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(parseInt(searchParams.get('page') || '0', 10) || 0, 0)
    const pageSize = Math.min(
      Math.max(parseInt(searchParams.get('page_size') || '200', 10) || 200, 1),
      500
    )

    const from = page * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabaseServer
      .from('quotes')
      .select(
        `
        id,
        quote_number,
        quote_panels!inner(id)
      `,
        { count: 'exact' }
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const ids = (data || []).map((r) => ({
      id: r.id as string,
      quote_number: r.quote_number as string
    }))

    const total = count ?? ids.length

    return NextResponse.json({
      page,
      page_size: pageSize,
      ids,
      total,
      has_more: from + ids.length < total
    })
  } catch (error) {
    console.error('opti-lab/quote-ids', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
