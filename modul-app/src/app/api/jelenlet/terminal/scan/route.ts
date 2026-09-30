import { NextResponse, type NextRequest } from 'next/server'

import { processJelenletTerminalScan } from '@/lib/jelenlet/terminal-scan'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getBearerSecret(request: NextRequest): string | null {
  const h = request.headers.get('authorization')
  if (h?.startsWith('Bearer ')) return h.slice(7).trim()
  const x =
    request.headers.get('x-jelenlet-secret') ||
    request.headers.get('X-Jelenlet-Secret')
  return x?.trim() ?? null
}

/**
 * Raspberry Pi → cloud jelenlét scan (nincs user session).
 * Auth: per-device token (hash in jelenlet_devices).
 * Body: { cardId?: string, pin?: string } — pontosan egy.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = createServiceClient()
    if (!admin) {
      return NextResponse.json(
        { error: 'Service role not configured' },
        { status: 503 }
      )
    }

    const token = getBearerSecret(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const cardId =
      typeof body.cardId === 'string' ? body.cardId : undefined
    const pin = typeof body.pin === 'string' ? body.pin : undefined

    const result = await processJelenletTerminalScan(admin, {
      token,
      cardId,
      pin
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message },
        { status: result.status }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        employeeId: result.employeeId,
        employeeName: result.employeeName,
        scanType: result.scanType,
        workDate: result.workDate,
        arrivalTime: result.arrivalTime,
        departureTime: result.departureTime
      },
      { status: 201 }
    )
  } catch (e) {
    console.error('jelenlet terminal/scan', e)
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 })
  }
}
