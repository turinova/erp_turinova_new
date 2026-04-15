import type { FootcounterDashboardStats, FootcounterHomeSlim } from '@/types/footcounter'
import { supabaseServer } from '@/lib/supabase-server'

const TZ = 'Europe/Budapest'

/** Fetch window: 7d chart + heatmap + same-weekday baseline. */
const CROSSINGS_LOOKBACK_DAYS = 40
const HEATMAP_LOOKBACK_DAYS = 28
const SAME_WEEKDAY_LOOKBACK_DAYS = 35

type HoursMode = 'open' | 'all'

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

/** Local hour 0–23 in Europe/Budapest for an instant. */
function budapestHour(isoUtc: string): number {
  const hourPart = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    hour12: false
  }).formatToParts(new Date(isoUtc))
  const h = hourPart.find(p => p.type === 'hour')?.value
  return h != null ? parseInt(h, 10) : 0
}

/** Monday = 0 … Sunday = 6 in Europe/Budapest. */
function budapestWeekdayMon0(isoUtc: string): number {
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short'
  }).format(new Date(isoUtc))
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6
  }
  return map[short] ?? 0
}

function isOpenHourBudapest(weekdayMon0: number, hour: number): boolean {
  // Mon–Fri: 08–17 (inclusive); Sat: 08–12 (inclusive); Sun: closed.
  if (weekdayMon0 >= 0 && weekdayMon0 <= 4) return hour >= 8 && hour <= 17
  if (weekdayMon0 === 5) return hour >= 8 && hour <= 12
  return false
}

function budapestDayKeyDaysAgo(daysAgo: number): string {
  const t = Date.now() - daysAgo * 24 * 60 * 60 * 1000
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(t))
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
export async function getFootcounterDashboardStats(
  deviceSlug: string,
  opts?: { hoursMode?: HoursMode }
): Promise<FootcounterDashboardStats> {
  const hoursMode: HoursMode = opts?.hoursMode ?? 'open'
  const { data: device, error: devErr } = await supabaseServer
    .from('footcounter_devices')
    .select('id, last_seen_at')
    .eq('slug', deviceSlug)
    .maybeSingle()

  if (devErr) {
    console.error('footcounter device lookup:', devErr)
    throw new Error(devErr.message)
  }

  const emptyHourly = () =>
    Array.from({ length: 24 }, (_, hour) => ({ hour, in_count: 0, out_count: 0 }))
  const emptyHeatmap = () => ({
    days: HEATMAP_LOOKBACK_DAYS,
    matrix: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
  })

  if (!device?.id) {
    return {
      device_slug: deviceSlug,
      today_in: 0,
      today_out: 0,
      total_in: 0,
      total_out: 0,
      last_event_at: null,
      device_last_seen: null,
      series_7d: last7DayKeys().map(day => ({ day, in_count: 0, out_count: 0 })),
      series_today_hourly: emptyHourly(),
      same_weekday_avg: null,
      heatmap_in: emptyHeatmap()
    }
  }

  const deviceId = device.id as string

  const [totalIn, totalOut] = await Promise.all([
    countCrossings(deviceId, 'in'),
    countCrossings(deviceId, 'out')
  ])
  const since = new Date(Date.now() - CROSSINGS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()

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
  const heatmapCutoffKey = budapestDayKeyDaysAgo(HEATMAP_LOOKBACK_DAYS)
  const todayWeekday = budapestWeekdayMon0(new Date().toISOString())

  let todayIn = 0
  let todayOut = 0
  let lastEventAt: string | null = null

  const hourlyToday = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    in_count: 0,
    out_count: 0
  }))
  const heatmapMatrix = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))

  const byDay = new Map<string, { in_count: number; out_count: number; weekday_mon0: number }>()

  for (const r of rows ?? []) {
    const at = r.occurred_at as string
    const dir = (r.direction as string)?.toLowerCase()
    if (!at) continue

    const dayKey = budapestDayKey(at)
    const wd = budapestWeekdayMon0(at)
    const h = budapestHour(at)

    const allowedByHours = hoursMode === 'all' ? true : isOpenHourBudapest(wd, h)
    if (allowedByHours) {
      if (lastEventAt == null || at > lastEventAt) lastEventAt = at
    }

    if (dayKey === todayKey) {
      if (allowedByHours) {
        if (dir === 'in') {
          todayIn += 1
          hourlyToday[h].in_count += 1
        } else if (dir === 'out') {
          todayOut += 1
          hourlyToday[h].out_count += 1
        }
      }
    }

    if (allowedByHours && dir === 'in' && dayKey >= heatmapCutoffKey) {
      heatmapMatrix[wd][h] += 1
    }

    if (allowedByHours) {
      if (!byDay.has(dayKey)) byDay.set(dayKey, { in_count: 0, out_count: 0, weekday_mon0: wd })
      const b = byDay.get(dayKey)!
      if (dir === 'in') b.in_count += 1
      else if (dir === 'out') b.out_count += 1
    }
  }

  const series_7d = last7DayKeys().map(day => {
    const v = byDay.get(day)
    return { day, in_count: v?.in_count ?? 0, out_count: v?.out_count ?? 0 }
  })

  const avgCutoffKey = budapestDayKeyDaysAgo(SAME_WEEKDAY_LOOKBACK_DAYS)
  let sumPastIn = 0
  let sumPastOut = 0
  let sampleDays = 0
  for (const [day, v] of byDay) {
    if (day === todayKey) continue
    if (day < avgCutoffKey) continue
    if (v.weekday_mon0 !== todayWeekday) continue
    sumPastIn += v.in_count
    sumPastOut += v.out_count
    sampleDays += 1
  }

  const same_weekday_avg =
    sampleDays > 0
      ? {
          sample_days: sampleDays,
          avg_in: sumPastIn / sampleDays,
          avg_out: sumPastOut / sampleDays,
          lookback_days: SAME_WEEKDAY_LOOKBACK_DAYS
        }
      : null

  return {
    device_slug: deviceSlug,
    today_in: todayIn,
    today_out: todayOut,
    total_in: totalIn,
    total_out: totalOut,
    last_event_at: lastEventAt,
    device_last_seen: (device.last_seen_at as string | null) ?? null,
    series_7d,
    series_today_hourly: hourlyToday,
    same_weekday_avg,
    heatmap_in: { days: HEATMAP_LOOKBACK_DAYS, matrix: heatmapMatrix }
  }
}

/** Strip heavy fields for home SSR card. */
export function slimFootcounterForHome(s: FootcounterDashboardStats): FootcounterHomeSlim {
  return {
    today_in: s.today_in,
    today_out: s.today_out,
    same_weekday_avg: s.same_weekday_avg,
    last_event_at: s.last_event_at,
    device_last_seen: s.device_last_seen,
    hourly_in: s.series_today_hourly.map(h => h.in_count)
  }
}
