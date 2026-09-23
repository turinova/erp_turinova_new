import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * GET /api/opti-lab/quotes
 * q= search | mode=random|recent|hard | limit=
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()
    const mode = searchParams.get('mode') || 'recent'
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1),
      500
    )

    if (q) {
      const { data, error } = await supabaseServer
        .from('quotes')
        .select(
          `
          id,
          quote_number,
          created_at,
          customers(name),
          quote_panels(id)
        `
        )
        .is('deleted_at', null)
        .or(`quote_number.ilike.%${q}%,order_number.ilike.%${q}%`)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // Also search by customer name (second pass if few results)
      let rows = data || []
      if (rows.length < limit) {
        const { data: byCustomer } = await supabaseServer
          .from('quotes')
          .select(
            `
            id,
            quote_number,
            created_at,
            customers!inner(name),
            quote_panels(id)
          `
          )
          .is('deleted_at', null)
          .ilike('customers.name', `%${q}%`)
          .order('created_at', { ascending: false })
          .limit(limit)

        const seen = new Set(rows.map((r) => r.id))
        for (const row of byCustomer || []) {
          if (!seen.has(row.id)) {
            rows.push(row)
            seen.add(row.id)
          }
          if (rows.length >= limit) break
        }
      }

      return NextResponse.json({ quotes: mapQuotes(rows) })
    }

    if (mode === 'hard') {
      // Quotes with lowest average usage_percentage among those with boards
      const { data: pricing, error } = await supabaseServer
        .from('quote_materials_pricing')
        .select('quote_id, usage_percentage, boards_used')
        .gt('boards_used', 0)
        .order('usage_percentage', { ascending: true })
        .limit(limit * 3)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const byQuote = new Map<string, { sum: number; n: number }>()
      for (const row of pricing || []) {
        const cur = byQuote.get(row.quote_id) || { sum: 0, n: 0 }
        cur.sum += Number(row.usage_percentage)
        cur.n += 1
        byQuote.set(row.quote_id, cur)
      }

      const ranked = [...byQuote.entries()]
        .map(([id, v]) => ({ id, avg: v.sum / v.n }))
        .sort((a, b) => a.avg - b.avg)
        .slice(0, limit)

      const ids = ranked.map((r) => r.id)
      if (ids.length === 0) {
        return NextResponse.json({ quotes: [] })
      }

      const { data: quotes, error: qErr } = await supabaseServer
        .from('quotes')
        .select(
          `
          id,
          quote_number,
          created_at,
          customers(name),
          quote_panels(id)
        `
        )
        .in('id', ids)
        .is('deleted_at', null)

      if (qErr) {
        return NextResponse.json({ error: qErr.message }, { status: 500 })
      }

      const order = new Map(ids.map((id, i) => [id, i]))
      const sorted = (quotes || []).sort(
        (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
      )
      return NextResponse.json({ quotes: mapQuotes(sorted) })
    }

    if (mode === 'random') {
      // Approximate random: fetch a larger window then shuffle
      const window = Math.min(limit * 10, 2000)
      const { data, error } = await supabaseServer
        .from('quotes')
        .select(
          `
          id,
          quote_number,
          created_at,
          customers(name),
          quote_panels(id)
        `
        )
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(window)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const withPanels = (data || []).filter(
        (r) => Array.isArray(r.quote_panels) && r.quote_panels.length > 0
      )
      shuffle(withPanels)
      return NextResponse.json({
        quotes: mapQuotes(withPanels.slice(0, limit))
      })
    }

    // recent (default)
    const { data, error } = await supabaseServer
      .from('quotes')
      .select(
        `
        id,
        quote_number,
        created_at,
        customers(name),
        quote_panels(id)
      `
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit * 2)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const withPanels = (data || []).filter(
      (r) => Array.isArray(r.quote_panels) && r.quote_panels.length > 0
    )

    return NextResponse.json({
      quotes: mapQuotes(withPanels.slice(0, limit))
    })
  } catch (error) {
    console.error('opti-lab/quotes', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function mapQuotes(
  rows: Array<{
    id: string
    quote_number: string
    created_at: string | null
    customers: { name?: string } | { name?: string }[] | null
    quote_panels: { id: string }[] | null
  }>
) {
  return rows.map((r) => {
    const c = Array.isArray(r.customers) ? r.customers[0] : r.customers
    return {
      id: r.id,
      quote_number: r.quote_number,
      customer_name: c?.name ?? null,
      created_at: r.created_at,
      panel_rows: r.quote_panels?.length ?? 0
    }
  })
}

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
}
