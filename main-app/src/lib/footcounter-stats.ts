import type { FootcounterDashboardStats } from '@/types/footcounter'
import { supabaseServer } from '@/lib/supabase-server'

const TZ = 'Europe/Budapest'

function budapestDayKey(isoUtc: string): string {
  const d = new Date(isoUtc)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d)
}

function budapestTodayKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
}

/** Last 7 calendar days in Budapest (approximate stepping from "now"). */
function last7DayKeys(): string[] {
  const keys: string[] = []
  const now = Date.now()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000)
    keys.push(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(d)
    )
  }
  return keys
}

async function countCrossings(deviceId: string, direction: 'in' | 'out'): Promise<number> {
  const { count, error } = await supabaseServer
    .from('footcounter_crossings')
    .select('id', { count: 'exact', head: true })
    .eq('device_id', deviceId)
    .eq('direction', direction)

  if (error) {
    console.error('footcounter_crossings count:', error)
    throw new Error(error.message)
  }
  return count ?? 0
}

/**
 * Dashboard stats without DB RPC (works when footcounter_dashboard_stats is missing).
 */
export async function getFootcounterDashboardStats(deviceSlug: string): Promise<FootcounterDashboardStats> {
  const { data: device, error: devErr } = await supabaseServer
    .from('footcounter_devices')
    .select('id, last_seen_at')
    .eq('slug', deviceSlug)
    .maybeSingle()

  if (devErr) {
    console.error('footcounter device lookup:', devErr)
    throw new Error(devErr.message)
  }

  if (!device?.id) {
    return {
      device_slug: deviceSlug,
      today_in: 0,
      today_out: 0,
      total_in: 0,
      total_out: 0,
      last_event_at: null,
      device_last_seen: null,
      series_7d: last7DayKeys().map(day => ({ day, in_count: 0, out_count: 0 }))
    }
  }

  const deviceId = device.id as string

  const [totalIn, totalOut] = await Promise.all([
    countCrossings(deviceId, 'in'),
    countCrossings(deviceId, 'out')
  ])
  const since = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()

  const { data: rows, error: rowErr } = await supabaseServer
    .from('footcounter_crossings')
    .select('occurred_at, direction')
    .eq('device_id', deviceId)
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: true })

  if (rowErr) {
    console.error('footcounter_crossings select:', rowErr)
    throw new Error(rowErr.message)
  }

  const todayKey = budapestTodayKey()
  let todayIn = 0
  let todayOut = 0
  let lastEventAt: string | null = null

  const byDay = new Map<string, { in_count: number; out_count: number }>()

  for (const r of rows ?? []) {
    const at = r.occurred_at as string
    const dir = (r.direction as string)?.toLowerCase()
    if (!at) continue
    if (lastEventAt == null || at > lastEventAt) lastEventAt = at

    const dayKey = budapestDayKey(at)
    if (dayKey === todayKey) {
      if (dir === 'in') todayIn += 1
      else if (dir === 'out') todayOut += 1
    }

    if (!byDay.has(dayKey)) byDay.set(dayKey, { in_count: 0, out_count: 0 })
    const b = byDay.get(dayKey)!
    if (dir === 'in') b.in_count += 1
    else if (dir === 'out') b.out_count += 1
  }

  const series_7d = last7DayKeys().map(day => {
    const v = byDay.get(day)
    return { day, in_count: v?.in_count ?? 0, out_count: v?.out_count ?? 0 }
  })

  return {
    device_slug: deviceSlug,
    today_in: todayIn,
    today_out: todayOut,
    total_in: totalIn,
    total_out: totalOut,
    last_event_at: lastEventAt,
    device_last_seen: (device.last_seen_at as string | null) ?? null,
    series_7d
  }
}
