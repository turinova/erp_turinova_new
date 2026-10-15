import { NextResponse } from 'next/server'

import { resolvePosLeanAuth } from '@/lib/pos/pos-lean-auth'
import { isSheetMachineCodeQuery } from '@/lib/sales/material-qty'
import { searchProductsForSale } from '@/lib/sales/queries'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Kind = 'all' | 'product' | 'sheet_material' | 'linear_material'

/** Pure digit stubs — too broad for full product RPC (anyag kód-pálya kivétel). */
const SHORT_DIGIT_MAX = 3

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
 * POS typeahead hot path — GET, lean staff auth (mint barcode/bootstrap).
 * Query: q, warehouseId, stockFirst?, inStockOnly?, limit?, kind?, includeMaterials?
 */
export async function GET(request: Request) {
  const totalStart = performance.now()
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()
  const warehouseId = (searchParams.get('warehouseId') ?? '').trim()
  const stockFirst = searchParams.get('stockFirst') !== '0'
  const inStockOnly = searchParams.get('inStockOnly') === '1'
  const limitRaw = Number(searchParams.get('limit') ?? '15')
  let limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(30, Math.floor(limitRaw)))
    : 15
  const kind = parseKind(searchParams.get('kind'))
  let includeMaterials = searchParams.get('includeMaterials') === '1'
  const sheetCodeQ = isSheetMachineCodeQuery(q)
  const materialKind =
    kind === 'sheet_material' || kind === 'linear_material'

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

  // Short pure-digit stubs: empty for product path.
  // Tábla gépkód prefix (312…) — ne throttle-öld, ha anyag keresés szándék.
  const allowSheetCodeDigits =
    sheetCodeQ &&
    (includeMaterials ||
      kind === 'sheet_material' ||
      kind === 'all')
  if (
    /^\d+$/.test(q) &&
    q.length <= SHORT_DIGIT_MAX &&
    !allowSheetCodeDigits
  ) {
    const totalMs = Math.round(performance.now() - totalStart)
    return NextResponse.json(
      { ok: true, rows: [], ms: totalMs, throttled: true },
      {
        headers: {
          'Cache-Control': 'private, no-store',
          'Server-Timing': `total;dur=${totalMs}`
        }
      }
    )
  }

  // Short queries: cheaper product-only — except anyag chip / tábla-kód.
  if (q.length < 4 && !materialKind && !allowSheetCodeDigits) {
    includeMaterials = false
    limit = Math.min(limit, 10)
  }

  // Tábla-kód 3+ digit: Mind/Tábla → anyagok be (entitlement később).
  if (allowSheetCodeDigits && kind !== 'product' && kind !== 'linear_material') {
    includeMaterials = true
  }
  if (materialKind) {
    includeMaterials = true
  }

  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: 'Nincs adatbázis kapcsolat.' },
      { status: 503 }
    )
  }

  const authResult = await resolvePosLeanAuth(supabase)
  if (!authResult.ok) {
    return NextResponse.json(
      { ok: false, message: authResult.error || 'Nincs bejelentkezés.' },
      {
        status: authResult.status,
        headers: {
          'Server-Timing': `auth;dur=${authResult.authMs}, total;dur=${Math.round(performance.now() - totalStart)}`
        }
      }
    )
  }

  const tenantId = authResult.auth.tenantId

  if (
    includeMaterials ||
    kind === 'sheet_material' ||
    kind === 'linear_material'
  ) {
    const { tenantHasLapszabaszat } = await import(
      '@/lib/lapszabaszat/entitlement'
    )
    includeMaterials = await tenantHasLapszabaszat(supabase, tenantId)
    if (
      !includeMaterials &&
      (kind === 'sheet_material' || kind === 'linear_material')
    ) {
      const totalMs = Math.round(performance.now() - totalStart)
      return NextResponse.json(
        { ok: true, rows: [], ms: totalMs },
        {
          headers: {
            'Cache-Control': 'private, no-store',
            'Server-Timing': `auth;dur=${authResult.authMs}, total;dur=${totalMs}`
          }
        }
      )
    }
  }

  // Sheet-code on "all" without lapszab: fall back to empty (ne product RPC 3 digiten).
  if (
    sheetCodeQ &&
    /^\d+$/.test(q) &&
    q.length <= SHORT_DIGIT_MAX &&
    !includeMaterials &&
    kind !== 'product'
  ) {
    const totalMs = Math.round(performance.now() - totalStart)
    return NextResponse.json(
      { ok: true, rows: [], ms: totalMs, throttled: true },
      {
        headers: {
          'Cache-Control': 'private, no-store',
          'Server-Timing': `auth;dur=${authResult.authMs}, total;dur=${totalMs}`
        }
      }
    )
  }

  const queryStart = performance.now()
  try {
    const rows = await searchProductsForSale(
      supabase,
      tenantId,
      q,
      warehouseId,
      { inStockOnly, stockFirst, limit, kind, includeMaterials }
    )
    const queryMs = Math.round(performance.now() - queryStart)
    const totalMs = Math.round(performance.now() - totalStart)
    return NextResponse.json(
      { ok: true, rows, ms: totalMs },
      {
        headers: {
          'Cache-Control': 'private, no-store',
          'Server-Timing': `auth;dur=${authResult.authMs}, search;dur=${queryMs}, total;dur=${totalMs}`
        }
      }
    )
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Nem sikerült keresni a termékeket.'
      },
      {
        status: 500,
        headers: {
          'Server-Timing': `auth;dur=${authResult.authMs}, total;dur=${Math.round(performance.now() - totalStart)}`
        }
      }
    )
  }
}
