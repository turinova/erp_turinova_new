import { NextResponse } from 'next/server'

import { getSessionUser } from '@/lib/auth/session'
import { tenantHasFootcounter } from '@/lib/footcounter/entitlement'
import { getFootcounterTodayStats } from '@/lib/footcounter/queries'
import { FOOTCOUNTER_PAGE } from '@/lib/footcounter/types'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
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

    const devices = await getFootcounterTodayStats(supabase, user.tenantId)
    return NextResponse.json({ devices })
  } catch (e) {
    console.error('footcounter stats', e)
    return NextResponse.json({ error: 'Stats failed' }, { status: 500 })
  }
}
