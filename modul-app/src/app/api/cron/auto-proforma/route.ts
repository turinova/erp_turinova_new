import { NextResponse, type NextRequest } from 'next/server'

import { rescueAutoProformaQueue } from '@/lib/partner/auto-proforma'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Elakadt partner díjbekérők: pending (after() elhalt) → indítás;
 * régóta processing → failed.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const admin = createServiceClient()
  if (!admin) return NextResponse.json({ error: 'no db' }, { status: 503 })

  const result = await rescueAutoProformaQueue(admin)
  return NextResponse.json(result)
}
