import { NextResponse } from 'next/server'

import {
  ACCESSORY_WEB_FILTERS,
  listAccessoriesPage,
  type AccessoryWebFilter
} from '@/lib/accessories/queries'
import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'

export const dynamic = 'force-dynamic'

/**
 * Termék lista / kereső — lean JSON (RPC). TanStack Query keystroke path.
 */
export async function GET(request: Request) {
  const totalStart = performance.now()
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').slice(0, 80)
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const webParam = searchParams.get('web') ?? 'all'
  const web: AccessoryWebFilter = (ACCESSORY_WEB_FILTERS as readonly string[]).includes(
    webParam
  )
    ? (webParam as AccessoryWebFilter)
    : 'all'

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
    const hasWebshop = await tenantHasWebshop(supabase, user.tenantId)
    const data = await listAccessoriesPage(supabase, user.tenantId, {
      q,
      page,
      web: hasWebshop ? web : 'all',
      hasWebshop
    })
    const queryMs = Math.round(performance.now() - queryStart)
    const totalMs = Math.round(performance.now() - totalStart)

    return NextResponse.json(
      {
        rows: data.rows,
        total: data.total,
        page: data.page,
        pageCount: data.pageCount
      },
      {
        headers: {
          'Server-Timing': `auth;dur=${authMs}, query;dur=${queryMs}, total;dur=${totalMs}`,
          'Cache-Control': 'private, no-store'
        }
      }
    )
  } catch (err) {
    console.error('/api/termekek', err)
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Nem sikerült betölteni a termékeket.'
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
