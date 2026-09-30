import { NextResponse } from 'next/server'

import { getSessionUser } from '@/lib/auth/session'
import { lookupPosBarcodeProduct } from '@/lib/pos/barcode-lookup'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POS exact barcode / SKU / belső vonalkód + on_hand.
 * Wedge hot path — ne server action.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = (searchParams.get('q') ?? searchParams.get('code') ?? '').trim()
  const warehouseId = (searchParams.get('warehouseId') ?? '').trim()

  if (!code) {
    return NextResponse.json(
      { ok: false, message: 'Üres vonalkód.', notFound: true },
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

  const result = await lookupPosBarcodeProduct(
    supabase,
    user.tenantId,
    code,
    warehouseId
  )

  if (!result.ok) {
    return NextResponse.json(result, {
      status: result.notFound ? 404 : 400
    })
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'private, no-store' }
  })
}
