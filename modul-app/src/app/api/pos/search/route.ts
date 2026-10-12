import { NextResponse } from 'next/server'

import { getSessionUser } from '@/lib/auth/session'
import { searchProductsForSale } from '@/lib/sales/queries'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Kind = 'all' | 'product' | 'sheet_material' | 'linear_material'

function parseKind(raw: string | null): Kind {
  if (
    raw === 'product' ||
    raw === 'sheet_material' ||
    raw === 'linear_material' ||
    raw === 'all'
  ) {
    return raw
  }
  return 'all'
}

/**
 * POS typeahead hot path — GET, nem Server Action.
 * Query: q, warehouseId, stockFirst?, inStockOnly?, limit?, kind?, includeMaterials?
 */
export async function GET(request: Request) {
  const t0 = performance.now()
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()
  const warehouseId = (searchParams.get('warehouseId') ?? '').trim()
  const stockFirst = searchParams.get('stockFirst') !== '0'
  const inStockOnly = searchParams.get('inStockOnly') === '1'
  const limitRaw = Number(searchParams.get('limit') ?? '15')
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(30, Math.floor(limitRaw)))
    : 15
  const kind = parseKind(searchParams.get('kind'))
  let includeMaterials = searchParams.get('includeMaterials') === '1'

  if (!q) {
    return NextResponse.json(
      { ok: false, message: 'Üres keresés.' },
      { status: 400 }
    )
  }
  if (!warehouseId) {
    return NextResponse.json(
      { ok: false, message: 'Válaszd ki a raktárat.' },
      { status: 400 }
    )
  }

  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return NextResponse.json(
      { ok: false, message: 'Nincs bejelentkezés.' },
      { status: 401 }
    )
  }

  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: 'Nincs adatbázis kapcsolat.' },
      { status: 503 }
    )
  }

  if (
    includeMaterials ||
    kind === 'sheet_material' ||
    kind === 'linear_material'
  ) {
    const { tenantHasLapszabaszat } = await import(
      '@/lib/lapszabaszat/entitlement'
    )
    includeMaterials = await tenantHasLapszabaszat(supabase, user.tenantId)
    if (
      !includeMaterials &&
      (kind === 'sheet_material' || kind === 'linear_material')
    ) {
      const ms = Math.round(performance.now() - t0)
      return NextResponse.json(
        { ok: true, rows: [], ms },
        {
          headers: {
            'Cache-Control': 'private, no-store',
            'Server-Timing': `search;dur=${ms}`
          }
        }
      )
    }
  }

  try {
    const rows = await searchProductsForSale(
      supabase,
      user.tenantId,
      q,
      warehouseId,
      { inStockOnly, stockFirst, limit, kind, includeMaterials }
    )
    const ms = Math.round(performance.now() - t0)
    return NextResponse.json(
      { ok: true, rows, ms },
      {
        headers: {
          'Cache-Control': 'private, no-store',
          'Server-Timing': `search;dur=${ms}`
        }
      }
    )
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error ? err.message : 'Nem sikerült keresni a termékeket.'
      },
      { status: 500 }
    )
  }
}
