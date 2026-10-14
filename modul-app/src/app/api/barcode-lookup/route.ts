import { NextResponse } from 'next/server'

import { lookupAccessoryByBarcode } from '@/lib/search/accessory-barcode-lookup'
import { resolveKeresoAuth } from '@/lib/search/kereso-auth'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Exact termék vonalkód / belső vonalkód / SKU lookup.
 * Kereső + Termékek lista no-focus wedge path.
 * Lean auth (mint `/api/kereso`) — nincs full getSessionUser bundle.
 */
export async function GET(request: Request) {
  const totalStart = performance.now()
  const { searchParams } = new URL(request.url)
  const code = (searchParams.get('q') ?? searchParams.get('code') ?? '').trim()
  if (!code) {
    return NextResponse.json(
      { ok: false, message: 'Üres vonalkód.', notFound: true },
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

  const authResult = await resolveKeresoAuth(supabase, false)
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
  const result = await lookupAccessoryByBarcode(
    supabase,
    authResult.auth.tenantId,
    code
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
