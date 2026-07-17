import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { hasPagePermission } from '@/lib/permissions-server'
import { supabaseServer } from '@/lib/supabase-server'
import { fetchAndUpsertWeatherRange } from '@/lib/footcounter-weather'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Sync daily + open-hours (8–17) hourly precipitation & wind from Open-Meteo (Kecskemét).
 * Query: ?days=90 (default) — how many past days to refresh (max 365).
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          }
        }
      }
    )

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowed = await hasPagePermission(user.id, '/footcounter-live')
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const daysRaw = request.nextUrl.searchParams.get('days')
    const days = Math.min(365, Math.max(7, parseInt(daysRaw || '90', 10) || 90))

    const result = await fetchAndUpsertWeatherRange(supabaseServer, days)
    return NextResponse.json(result)
  } catch (e) {
    console.error('footcounter weather sync:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Weather sync failed' },
      { status: 500 }
    )
  }
}
