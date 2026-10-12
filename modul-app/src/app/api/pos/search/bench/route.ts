import { NextResponse } from 'next/server'

import { getSessionUser } from '@/lib/auth/session'
import { searchPosProductsRpc } from '@/lib/pos/product-search'
import { searchProductsForSale } from '@/lib/sales/queries'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function timeMs(fn: () => Promise<unknown>, rounds: number) {
  await fn() // warm
  const times: number[] = []
  for (let i = 0; i < rounds; i++) {
    const t0 = performance.now()
    await fn()
    times.push(Math.round(performance.now() - t0))
  }
  times.sort((a, b) => a - b)
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
  const p50 = times[Math.floor(times.length / 2)]!
  const p95 =
    times[Math.min(times.length - 1, Math.ceil(times.length * 0.95) - 1)]!
  return { avg, p50, p95, raw: times }
}

/**
 * Auth’d POS search bench: RPC vs legacy ILIKE merge path.
 * GET /api/pos/search/bench?q=...&warehouseId=...&rounds=5
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? 'csavar').trim()
  const warehouseId = (searchParams.get('warehouseId') ?? '').trim()
  const rounds = Math.max(
    1,
    Math.min(10, Number(searchParams.get('rounds') ?? '5') || 5)
  )

  if (!warehouseId) {
    return NextResponse.json(
      { ok: false, message: 'warehouseId kötelező.' },
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

  const tenantId = user.tenantId

  const rpc = await timeMs(
    () =>
      searchPosProductsRpc(supabase, tenantId, warehouseId, q, {
        limit: 15,
        stockFirst: true
      }),
    rounds
  )

  const viaSearchProducts = await timeMs(
    () =>
      searchProductsForSale(supabase, tenantId, q, warehouseId, {
        limit: 15,
        stockFirst: true,
        kind: 'product',
        includeMaterials: false
      }),
    rounds
  )

  // Legacy: force ILIKE by calling accessories path via temporary null RPC
  // We approximate by selecting ILIKE candidates then accessories_on_hand once.
  const legacy = await timeMs(async () => {
    const safe = q.trim().replace(/[%_,]/g, '')
    const { data: rows } = await supabase
      .from('accessories')
      .select('id, name, sku')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null)
      .or(
        `name.ilike.%${safe}%,sku.ilike.%${safe}%,barcode.ilike.%${safe}%,barcode_internal.ilike.%${safe}%`
      )
      .limit(30)
    const ids = (rows ?? []).map((r) => r.id as string)
    if (ids.length === 0) return
    await supabase.rpc('accessories_on_hand', {
      p_tenant_id: tenantId,
      p_warehouse_id: warehouseId,
      p_accessory_ids: ids
    })
  }, rounds)

  return NextResponse.json(
    {
      ok: true,
      q,
      warehouseId,
      rounds,
      rpc_search_pos_products: rpc,
      searchProductsForSale_productOnly: viaSearchProducts,
      legacy_ilike_plus_batch_on_hand: legacy,
      note:
        'rpc vs legacy: how much lean RPC+batch wins over PostgREST ILIKE. Client also drops Server Action overhead via GET /api/pos/search + LRU.'
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  )
}
