import { NextResponse } from 'next/server'

import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'
import {
  listShopCatalog,
  normalizeShopCatalogFilter
} from '@/lib/webshop/product-queries'

export const dynamic = 'force-dynamic'

/**
 * Bolt katalógus lista / kereső — lean JSON (RPC).
 * TanStack Query keystroke path — ne RSC `router.replace`.
 */
export async function GET(request: Request) {
  const totalStart = performance.now()
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').slice(0, 80)
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const filter = normalizeShopCatalogFilter(searchParams.get('filter'))

  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return NextResponse.json({ error: 'Nincs bejelentkezés.' }, { status: 401 })
  }

  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Nincs adatbázis kapcsolat.' }, { status: 503 })
  }

  const authMs = Math.round(performance.now() - totalStart)
  const queryStart = performance.now()

  try {
    if (!(await tenantHasWebshop(supabase, user.tenantId))) {
      return NextResponse.json({ error: 'Az Online bolt nincs bekapcsolva.' }, { status: 403 })
    }

    const data = await listShopCatalog(supabase, user.tenantId, { filter, q, page })
    const queryMs = Math.round(performance.now() - queryStart)
    const totalMs = Math.round(performance.now() - totalStart)

    return NextResponse.json(
      {
        rows: data.rows,
        total: data.total,
        page: data.page,
        pageCount: data.pageCount,
        counts: data.counts
      },
      {
        headers: {
          'Server-Timing': `auth;dur=${authMs}, query;dur=${queryMs}, total;dur=${totalMs}`,
          'Cache-Control': 'private, no-store'
        }
      }
    )
  } catch (err) {
    console.error('/api/webshop/katalogus', err)
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Nem sikerült betölteni a katalógust.'
      },
      {
        status: 500,
        headers: {
          'Server-Timing': `auth;dur=${authMs}, total;dur=${Math.round(performance.now() - totalStart)}`
        }
      }
    )
  }
}
