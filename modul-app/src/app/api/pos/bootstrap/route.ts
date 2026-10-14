import { NextResponse } from 'next/server'

import {
  loadPosBootstrap,
  parsePosBootstrapInclude
} from '@/lib/pos/bootstrap'
import { resolvePosLeanAuth } from '@/lib/pos/pos-lean-auth'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POS mount bootstrap — shift + quick/frequent + progress + chips egy GET.
 * Typeahead / barcode / sale mutációk külön pathon maradnak.
 */
export async function GET(request: Request) {
  const totalStart = performance.now()
  const { searchParams } = new URL(request.url)
  const warehouseId = (searchParams.get('warehouseId') ?? '').trim()
  const registerId = (searchParams.get('registerId') ?? '').trim()
  const include = parsePosBootstrapInclude(searchParams.get('include'))

  if (include.shift && !registerId) {
    return NextResponse.json(
      { ok: false, message: 'Válaszd ki a pénztárat.' },
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
  try {
    const data = await loadPosBootstrap(
      supabase,
      authResult.auth.tenantId,
      { warehouseId, registerId, include }
    )
    const queryMs = Math.round(performance.now() - queryStart)
    const totalMs = Math.round(performance.now() - totalStart)
    return NextResponse.json(
      { ok: true, ...data },
      {
        headers: {
          'Cache-Control': 'private, no-store',
          'Server-Timing': `auth;dur=${authResult.authMs}, query;dur=${queryMs}, total;dur=${totalMs}`
        }
      }
    )
  } catch (err) {
    console.error('GET /api/pos/bootstrap', err)
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error ? err.message : 'Nem sikerült a POS bootstrap.'
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
