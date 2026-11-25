import { NextResponse } from 'next/server'

import {
  displayShouldBeOn,
  normalizeOpeningHours,
  openStatus,
  type OpeningHours
} from '@/lib/opening-hours'
import { createServiceClient } from '@/lib/supabase/service'

type Params = Promise<{ slug: string }>

const DEFAULT_PAD = 5

/**
 * Publikus (kiosk Pi): a cégadatok nyitvatartása + monitor be/ki (±5 perc).
 * GET /api/kiosk/<slug>/hours
 */
export async function GET(
  _request: Request,
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

  const slugNorm = decodeURIComponent(slug).trim().toLowerCase()
  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .select('id, slug, status')
    .eq('slug', slugNorm)
    .maybeSingle()

  if (tenantError || !tenant?.id || tenant.status !== 'active') {
    return NextResponse.json({ error: 'Kiosk nem található.' }, { status: 404 })
  }

  const { data: company, error: companyError } = await admin
    .from('tenant_companies')
    .select('opening_hours')
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  if (companyError) {
    console.error('kiosk hours', companyError.message)
    return NextResponse.json(
      { error: 'Nem sikerült betölteni a nyitvatartást.' },
      { status: 500 }
    )
  }

  const hours = normalizeOpeningHours(company?.opening_hours ?? null)
  const now = new Date()
  const padMinutes = DEFAULT_PAD

  // Ha nincs megadva nyitvatartás: ne kapcsoljuk le a monitort tévedésből.
  const displayOn = hours ? displayShouldBeOn(hours, now, padMinutes) : true
  const status = hours ? openStatus(hours, now) : null

  return NextResponse.json(
    {
      slug: tenant.slug,
      padMinutes,
      timezone: 'Europe/Budapest',
      /** Monitor legyen-e bekapcsolva (nyitás−5 … zárás+5). */
      displayOn,
      open: status?.open ?? null,
      label: status?.label ?? 'Nincs megadva nyitvatartás · monitor bekapcsolva',
      hours: hours as OpeningHours | null
    },
    {
      headers: {
        'Cache-Control': 'no-store'
      }
    }
  )
}
