import { NextResponse } from 'next/server'

import { searchA4Products } from '@/lib/a4-barcode-sheets/queries'
import { resolveKeresoAuth } from '@/lib/search/kereso-auth'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Lean typeahead vonalkód lap cellához — barcode mezőkkel. */
export async function GET(request: Request) {
  const totalStart = performance.now()
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(
    25,
    Math.max(1, Number(searchParams.get('limit')) || 15)
  )

  if (q.length < 2) {
    return NextResponse.json({ rows: [] })
  }

  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Nincs adatbázis kapcsolat.' },
      { status: 503 }
    )
  }

  const authResult = await resolveKeresoAuth(supabase, false)
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }
  if (authResult.auth.isPartnerSearch) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const rows = await searchA4Products(
      supabase,
      authResult.auth.tenantId,
      q,
      limit
    )
    return NextResponse.json(
      { rows },
      {
        headers: {
          'Server-Timing': `total;dur=${Math.round(performance.now() - totalStart)}`
        }
      }
    )
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Nem sikerült keresni a termékek között.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
