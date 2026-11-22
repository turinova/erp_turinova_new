import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

import { authorizeKioskDevice } from '@/lib/kiosk/device-auth'
import {
  parseKioskGuest,
  parseKioskLines,
  parseSubmissionId
} from '@/lib/kiosk/parse-request'
import { hitRateLimit } from '@/lib/kiosk/rate-limit'
import { submitKioskOrder } from '@/lib/kiosk/submit'
import { createServiceClient } from '@/lib/supabase/service'

type Params = Promise<{ slug: string }>

const RATE_LIMIT = 10
const RATE_WINDOW_MS = 10 * 60 * 1000

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for')
  return fwd?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
}

export async function POST(
  request: NextRequest,
  context: { params: Params }
) {
  const { slug } = await context.params
  const admin = createServiceClient()
  if (!admin) {
    return NextResponse.json(
      { error: 'Szerver konfiguráció hiányzik.' },
      { status: 503 }
    )
  }

  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .select('id')
    .eq('slug', decodeURIComponent(slug).trim().toLowerCase())
    .maybeSingle()

  if (tenantError || !tenant?.id) {
    return NextResponse.json({ error: 'Kiosk nem található.' }, { status: 404 })
  }
  const tenantId = tenant.id as string

  const auth = await authorizeKioskDevice(admin, tenantId, request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const limiterKey = `${tenantId}:${auth.deviceId ?? clientIp(request)}`
  if (hitRateLimit(limiterKey, RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json(
      {
        error: 'Túl sok leadás rövid idő alatt. Szólj a pultnál.',
        code: 'rate_limited'
      },
      { status: 429 }
    )
  }

  let body: Record<string, unknown>
  try {
    const raw = (await request.json()) as unknown
    body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  } catch {
    return NextResponse.json({ error: 'Érvénytelen JSON.' }, { status: 400 })
  }

  const lines = parseKioskLines(body.lines)
  const guest = parseKioskGuest(body.guest)
  const submissionId = parseSubmissionId(body.submissionId)
  const expected = Number(body.expectedTotalGross)

  if (!lines || !guest || !submissionId) {
    return NextResponse.json(
      { error: 'Hiányos leadás. Próbáld újra.', code: 'validation' },
      { status: 400 }
    )
  }

  const result = await submitKioskOrder(admin, {
    tenantId,
    deviceId: auth.deviceId,
    submissionId,
    lines,
    guest,
    expectedTotalGross: Number.isFinite(expected) ? Math.round(expected) : null
  })

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.message,
        code: result.code,
        ...(result.totalGross != null ? { totalGross: result.totalGross } : {})
      },
      { status: result.status }
    )
  }

  revalidatePath('/ajanlatok')
  revalidatePath('/')

  return NextResponse.json({
    ok: true,
    quoteNumber: result.quoteNumber,
    totalGross: result.totalGross
  })
}
