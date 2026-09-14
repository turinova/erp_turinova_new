import { NextResponse } from 'next/server'

import { getSessionUser } from '@/lib/auth/session'
import { getWeeklyEdge } from '@/lib/home/chart-queries'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const weekOffset = Number(searchParams.get('weekOffset') || '0')
  if (!Number.isFinite(weekOffset) || Math.abs(weekOffset) > 52) {
    return NextResponse.json({ error: 'Invalid weekOffset' }, { status: 400 })
  }

  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'No database' }, { status: 503 })
  }

  try {
    const data = await getWeeklyEdge(
      supabase,
      user.tenantId,
      Math.trunc(weekOffset)
    )
    return NextResponse.json(data)
  } catch (e) {
    console.error('api/home/weekly-edge', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    )
  }
}
