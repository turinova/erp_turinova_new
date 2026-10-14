import { NextResponse } from 'next/server'

import { lookupPosBarcodeProduct } from '@/lib/pos/barcode-lookup'
import { resolvePosLeanAuth } from '@/lib/pos/pos-lean-auth'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POS exact barcode / SKU / belső vonalkód + on_hand.
 * Wedge hot path — lean staff auth (mint kereső), ne full getSessionUser.
 */
export async function GET(request: Request) {
  const totalStart = performance.now()
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

  const queryStart = performance.now()
  const result = await lookupPosBarcodeProduct(
    supabase,
    authResult.auth.tenantId,
    code,
    warehouseId
  )
  const queryMs = Math.round(performance.now() - queryStart)
  const totalMs = Math.round(performance.now() - totalStart)
  const timing = `auth;dur=${authResult.authMs}, query;dur=${queryMs}, total;dur=${totalMs}`

  if (!result.ok) {
    return NextResponse.json(result, {
      status: result.notFound ? 404 : 400,
      headers: {
        'Cache-Control': 'private, no-store',
        'Server-Timing': timing
      }
    })
  }

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'private, no-store',
      'Server-Timing': timing
    }
  })
}
