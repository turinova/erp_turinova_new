import { NextResponse } from 'next/server'

import { resolveKeresoAuth } from '@/lib/search/kereso-auth'
import { searchProductsForPurchaseOrder } from '@/lib/purchase-orders/queries'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Lean CSO / termék typeahead — resolveKeresoAuth + search_accessories_page.
 * Middleware skip (mint /api/kereso).
 */
export async function GET(request: Request) {
  const totalStart = performance.now()
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(
    25,
    Math.max(1, Number(searchParams.get('limit')) || 15)
  )

  if (q.length < 2) {
    return NextResponse.json(
      { rows: [] },
      {
        headers: {
          'Server-Timing': `total;dur=${Math.round(performance.now() - totalStart)}`
        }
      }
    )
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
      {
        status: authResult.status,
        headers: {
          'Server-Timing': `auth;dur=${authResult.authMs}, total;dur=${Math.round(performance.now() - totalStart)}`
        }
      }
    )
  }

  if (authResult.auth.isPartnerSearch) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }

  const searchStart = performance.now()
  try {
    const rows = await searchProductsForPurchaseOrder(
      supabase,
      authResult.auth.tenantId,
      q,
      limit
    )
    const searchMs = Math.round(performance.now() - searchStart)
    return NextResponse.json(
      { rows },
      {
        headers: {
          'Server-Timing': `auth;dur=${authResult.authMs}, search;dur=${searchMs}, total;dur=${Math.round(performance.now() - totalStart)}`
        }
      }
    )
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Nem sikerült keresni a termékek között.'
    return NextResponse.json(
      { error: message },
      {
        status: 500,
        headers: {
          'Server-Timing': `auth;dur=${authResult.authMs}, total;dur=${Math.round(performance.now() - totalStart)}`
        }
      }
    )
  }
}
