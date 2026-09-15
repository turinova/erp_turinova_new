import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { getPartnerSession } from '@/lib/auth/partner-session'
import { getSessionUser } from '@/lib/auth/session'
import {
  parseSearchKindParam,
  searchMaterialsUnified
} from '@/lib/search/materials-search'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Gyors kereső API — staff + partner.
 * Kerüli a teljes RSC navigációt gépelés közben.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.min(
    50,
    Math.max(1, Number(searchParams.get('limit')) || 25)
  )
  const kind = parseSearchKindParam(searchParams.get('kind'))

  if (!q) {
    return NextResponse.json({
      rows: [],
      total: 0,
      page,
      limit,
      kind
    })
  }

  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Nincs adatbázis kapcsolat.' },
      { status: 503 }
    )
  }

  const hdrs = await headers()
  const surface = hdrs.get('x-modul-surface')
  let tenantId: string | null = null

  if (surface === 'partner') {
    const partner = await getPartnerSession()
    if (!partner?.selectedTenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    tenantId = partner.selectedTenantId
  } else {
    const staff = await getSessionUser()
    if (!staff?.tenantId || staff.isDevSession) {
      // Path-mode partner fallback (nincs surface header)
      const partner = await getPartnerSession()
      if (partner?.selectedTenantId) {
        tenantId = partner.selectedTenantId
      } else {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } else {
      if (!staff.allowedPages.includes('/kereso')) {
        return NextResponse.json(
          { error: 'Nincs jogosultság.' },
          { status: 403 }
        )
      }
      tenantId = staff.tenantId
    }
  }

  try {
    const result = await searchMaterialsUnified(supabase, {
      tenantId,
      q,
      page,
      limit,
      kind
    })
    return NextResponse.json({
      rows: result.rows,
      total: result.total,
      page: result.page,
      limit: result.limit,
      kind
    })
  } catch (e) {
    console.error('api/kereso', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Keresés sikertelen.' },
      { status: 500 }
    )
  }
}
