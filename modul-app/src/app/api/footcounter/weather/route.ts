import { NextResponse, type NextRequest } from 'next/server'

import { getSessionUser } from '@/lib/auth/session'
import { tenantHasFootcounter } from '@/lib/footcounter/entitlement'
import { fetchAndUpsertWeatherRange } from '@/lib/footcounter/weather-sync'
import { FOOTCOUNTER_PAGE } from '@/lib/footcounter/types'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Open-Meteo → footcounter_daily_weather upsert (modul-app saját DB).
 * Query: ?days=120 (7–365).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!user.allowedPages.includes(FOOTCOUNTER_PAGE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json({ error: 'DB unavailable' }, { status: 503 })
    }

    const entitled = await tenantHasFootcounter(supabase, user.tenantId)
    if (!entitled && !user.isDevSession) {
      return NextResponse.json({ error: 'Add-on not enabled' }, { status: 403 })
    }

    const admin = createServiceClient()
    if (!admin) {
      return NextResponse.json(
        { error: 'Service role not configured' },
        { status: 503 }
      )
    }

    const daysRaw = request.nextUrl.searchParams.get('days')
    const days = Math.min(365, Math.max(7, parseInt(daysRaw || '120', 10) || 120))

    const result = await fetchAndUpsertWeatherRange(admin, days)
    return NextResponse.json(result)
  } catch (e) {
    console.error('footcounter weather sync', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Weather sync failed' },
      { status: 500 }
    )
  }
}
