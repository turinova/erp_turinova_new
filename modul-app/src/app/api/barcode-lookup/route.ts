import { NextResponse } from 'next/server'

import { getSessionUser } from '@/lib/auth/session'
import { lookupAccessoryByBarcode } from '@/lib/search/accessory-barcode-lookup'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Exact termék vonalkód / belső vonalkód / SKU lookup.
 * Kereső + Termékek lista no-focus wedge path.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = (searchParams.get('q') ?? searchParams.get('code') ?? '').trim()
  if (!code) {
    return NextResponse.json(
      { ok: false, message: 'Üres vonalkód.', notFound: true },
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

  const result = await lookupAccessoryByBarcode(
    supabase,
    user.tenantId,
    code
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
