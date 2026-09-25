import { NextResponse, type NextRequest } from 'next/server'

import { checkAndStoreDomain, DOMAIN_SELECT, type DomainRow } from '@/lib/storefront/domains/service'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BATCH = 10
const MIN_AGE_MS = 4 * 60 * 1000
/** Egy hét után már nem figyeljük automatikusan — a Csatornák oldalról újraindítható. */
const GIVE_UP_MS = 7 * 24 * 60 * 60 * 1000

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const admin = createServiceClient()
  if (!admin) return NextResponse.json({ error: 'no db' }, { status: 503 })

  const now = Date.now()
  const { data, error } = await admin
    .from('tenant_domains')
    .select(DOMAIN_SELECT)
    .in('status', ['pending', 'verifying'])
    .is('deleted_at', null)
    .gte('created_at', new Date(now - GIVE_UP_MS).toISOString())
    .or(`last_checked_at.is.null,last_checked_at.lt.${new Date(now - MIN_AGE_MS).toISOString()}`)
    .order('last_checked_at', { ascending: true, nullsFirst: true })
    .limit(BATCH)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: { hostname: string; status: string }[] = []
  for (const row of (data ?? []) as DomainRow[]) {
    const checked = await checkAndStoreDomain(admin, row)
    results.push({ hostname: checked.hostname, status: checked.status })
  }
  return NextResponse.json({ checked: results.length, results })
}
