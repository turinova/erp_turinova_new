import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { getPartnerSession } from '@/lib/auth/partner-session'
import { getSessionUser } from '@/lib/auth/session'
import {
  allowedUnifiedKinds,
  getTenantPartnerSettings,
  partnerSearchKindsFromSettings,
  resolvePartnerSearchKind
} from '@/lib/partner-settings/queries'
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
  const requestedKind = parseSearchKindParam(searchParams.get('kind'))

  if (!q) {
    return NextResponse.json({
      rows: [],
      total: 0,
      page,
      limit,
      kind: requestedKind
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
  const referer = hdrs.get('referer') ?? ''
  const fromPartnerUi =
    surface === 'partner' || referer.includes('/partner/')

  const partner = await getPartnerSession()
  const staff = await getSessionUser()

  let tenantId: string | null = null
  let isPartnerSearch = false

  if (fromPartnerUi && partner?.selectedTenantId) {
    tenantId = partner.selectedTenantId
    isPartnerSearch = true
  } else if (staff?.tenantId && !staff.isDevSession) {
    if (!staff.allowedPages.includes('/kereso')) {
      return NextResponse.json(
        { error: 'Nincs jogosultság.' },
        { status: 403 }
      )
    }
    tenantId = staff.tenantId
  } else if (partner?.selectedTenantId) {
    tenantId = partner.selectedTenantId
    isPartnerSearch = true
  } else {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    let kind = requestedKind
    let allowedKinds: ReturnType<typeof allowedUnifiedKinds> | undefined

    if (isPartnerSearch) {
      const settings = await getTenantPartnerSettings(supabase, tenantId)
      const kinds = partnerSearchKindsFromSettings(settings)
      allowedKinds = allowedUnifiedKinds(kinds)
      kind = resolvePartnerSearchKind(requestedKind, kinds)
    }

    const result = await searchMaterialsUnified(supabase, {
      tenantId,
      q,
      page,
      limit,
      kind,
      allowedKinds
    })
    return NextResponse.json({
      rows: result.rows,
      total: result.total,
      page: result.page,
      limit: result.limit,
      kind,
      allowedKinds: isPartnerSearch ? allowedKinds : undefined
    })
  } catch (e) {
    console.error('api/kereso', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Keresés sikertelen.' },
      { status: 500 }
    )
  }
}
