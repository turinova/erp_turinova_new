import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import {
  allowedUnifiedKinds,
  getTenantPartnerSettings,
  partnerSearchKindsFromSettings,
  resolvePartnerSearchKind
} from '@/lib/partner-settings/queries'
import { resolveKeresoAuth } from '@/lib/search/kereso-auth'
import {
  enrichUnifiedRowsWithStockOnHand,
  parseSearchKindParam,
  searchMaterialsUnified
} from '@/lib/search/materials-search'
import { tenantHasBeszerzes } from '@/lib/beszerzes/entitlement'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Gyors kereső API — staff + partner.
 * Lean auth (1× getUser), RPC search, Server-Timing.
 */
export async function GET(request: Request) {
  const totalStart = performance.now()
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

  const authResult = await resolveKeresoAuth(supabase, fromPartnerUi)
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

  const { tenantId, isPartnerSearch } = authResult.auth

  try {
    let kind = requestedKind
    let allowedKinds: ReturnType<typeof allowedUnifiedKinds> | undefined

    if (isPartnerSearch) {
      const settings = await getTenantPartnerSettings(supabase, tenantId)
      const kinds = partnerSearchKindsFromSettings(settings)
      allowedKinds = allowedUnifiedKinds(kinds)
      kind = resolvePartnerSearchKind(requestedKind, kinds)
    }

    const searchStart = performance.now()
    const result = await searchMaterialsUnified(supabase, {
      tenantId,
      q,
      page,
      limit,
      kind,
      allowedKinds
    })

    const showProcurementStock =
      !isPartnerSearch &&
      (await tenantHasBeszerzes(supabase, tenantId))

    const rows = showProcurementStock
      ? await enrichUnifiedRowsWithStockOnHand(
          supabase,
          tenantId,
          result.rows
        )
      : result.rows

    const searchMs = Math.round(performance.now() - searchStart)
    const totalMs = Math.round(performance.now() - totalStart)

    return NextResponse.json(
      {
        rows,
        total: result.total,
        page: result.page,
        limit: result.limit,
        kind,
        allowedKinds: isPartnerSearch ? allowedKinds : undefined,
        showProcurementStock
      },
      {
        headers: {
          'Server-Timing': `auth;dur=${authResult.authMs}, search;dur=${searchMs}, total;dur=${totalMs}`
        }
      }
    )
  } catch (e) {
    console.error('api/kereso', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Keresés sikertelen.' },
      {
        status: 500,
        headers: {
          'Server-Timing': `auth;dur=${authResult.authMs}, total;dur=${Math.round(performance.now() - totalStart)}`
        }
      }
    )
  }
}
