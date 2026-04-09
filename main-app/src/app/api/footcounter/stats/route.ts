import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { getFootcounterDashboardStats } from '@/lib/footcounter-stats'
import { hasPagePermission } from '@/lib/permissions-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Authenticated dashboard stats for Bejárat élő (charts + KPIs).
 * Query: ?device_slug=default
 */
export async function GET(request: NextRequest) {
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

    const slug =
      request.nextUrl.searchParams.get('device_slug')?.trim() ||
      process.env.FOOTCOUNTER_STATS_DEVICE_SLUG?.trim() ||
      'default'

    const data = await getFootcounterDashboardStats(slug)
    return NextResponse.json(data)
  } catch (e) {
    console.error('footcounter stats:', e)
    return NextResponse.json({ error: 'Stats failed' }, { status: 500 })
  }
}
