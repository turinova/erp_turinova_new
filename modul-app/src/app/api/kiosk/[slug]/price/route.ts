import { NextRequest, NextResponse } from 'next/server'

import { authorizeKioskDevice } from '@/lib/kiosk/device-auth'
import { parseKioskLines } from '@/lib/kiosk/parse-request'
import { calculateKioskCartPrice } from '@/lib/kiosk/price'
import { createServiceClient } from '@/lib/supabase/service'

type Params = Promise<{ slug: string }>

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
    .select('id, slug')
    .eq('slug', decodeURIComponent(slug).trim().toLowerCase())
    .maybeSingle()

  if (tenantError || !tenant?.id) {
    return NextResponse.json({ error: 'Kiosk nem található.' }, { status: 404 })
  }

  const auth = await authorizeKioskDevice(admin, tenant.id as string, request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Érvénytelen JSON.' }, { status: 400 })
  }

  const lines = parseKioskLines(
    body && typeof body === 'object'
      ? (body as { lines?: unknown }).lines
      : null
  )
  if (!lines) {
    return NextResponse.json(
      { error: 'Érvénytelen kosár (lines).' },
      { status: 400 }
    )
  }

  const result = await calculateKioskCartPrice(
    admin,
    tenant.id as string,
    lines
  )
  if (!result.ok) {
    const status =
      result.error.code === 'unplaced' || result.error.code === 'validation'
        ? 422
        : 400
    return NextResponse.json(
      { error: result.error.message, code: result.error.code },
      { status }
    )
  }

  return NextResponse.json(result.data)
}
