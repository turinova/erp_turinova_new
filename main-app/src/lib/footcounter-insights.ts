import type {
  FootcounterDashboardStats,
  FootcounterDaySeries,
  FootcounterMonthSummary,
  FootcounterMonthTrend,
  FootcounterWeekdayProfile
} from '@/types/footcounter'
import { last12MonthKeys } from '@/lib/footcounter-format'
import { FOOTCOUNTER_LOCAL_TZ } from '@/lib/footcounter-weather'
import { supabaseServer } from '@/lib/supabase-server'

const WEEKDAY_LABELS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']

export function computeMonthSummary(series: FootcounterDaySeries[]): FootcounterMonthSummary {
  const days_in_month = series.length
  const active = series.filter(d => d.in_count > 0)
  const active_days = active.length
  const sumIn = series.reduce((s, d) => s + d.in_count, 0)
  const sumTotal = series.reduce((s, d) => s + d.in_count + d.out_count, 0)

  let busiest = active[0]
  let slowest = active[0]
  for (const d of active) {
    if (!busiest || d.in_count > busiest.in_count) busiest = d
    if (!slowest || d.in_count < slowest.in_count) slowest = d
  }

  return {
    days_in_month,
    active_days,
    avg_in_per_active_day: active_days > 0 ? sumIn / active_days : 0,
    avg_total_per_active_day: active_days > 0 ? sumTotal / active_days : 0,
    busiest_day: busiest?.day ?? null,
    busiest_in: busiest?.in_count ?? 0,
    slowest_day: slowest?.day ?? null,
    slowest_in: slowest?.in_count ?? 0
  }
}

export function computePeakHour(
  hourly: FootcounterDashboardStats['series_today_hourly']
): { hour: number | null; in_count: number } {
  let bestHour: number | null = null
  let bestIn = 0
  for (const h of hourly) {
    if (h.in_count > bestIn) {
      bestIn = h.in_count
      bestHour = h.hour
    }
  }
  return { hour: bestHour, in_count: bestIn }
}

export function computeWeekdayProfileFromDaily(
  byDay: Map<string, { in_count: number; out_count: number; weekday_mon0: number }>,
  lookbackDays: number,
  todayKey: string
): FootcounterWeekdayProfile[] {
  const cutoff = new Date(todayKey)
  cutoff.setDate(cutoff.getDate() - lookbackDays)
  const cutoffKey = cutoff.toISOString().slice(0, 10)

  const buckets = new Map<number, { sum: number; n: number }>()
  for (const [day, v] of byDay) {
    if (day < cutoffKey) continue
    const b = buckets.get(v.weekday_mon0) ?? { sum: 0, n: 0 }
    b.sum += v.in_count
    b.n += 1
    buckets.set(v.weekday_mon0, b)
  }

  return WEEKDAY_LABELS.map((label, weekday_mon0) => {
    const b = buckets.get(weekday_mon0)
    return {
      weekday_mon0,
      label,
      avg_in: b && b.n > 0 ? b.sum / b.n : 0,
      sample_days: b?.n ?? 0
    }
  })
}

export function computeMomChangePct(
  seriesMonth: FootcounterDaySeries[],
  prevMonthIn: number
): number | null {
  const currentIn = seriesMonth.reduce((s, d) => s + d.in_count, 0)
  if (prevMonthIn <= 0) return null
  return Math.round(((currentIn - prevMonthIn) / prevMonthIn) * 100)
}

export async function attachMonthWeather(stats: FootcounterDashboardStats): Promise<FootcounterDashboardStats> {
  const days = stats.series_month.map(s => s.day)
  if (!days.length) return { ...stats, month_weather: [] }

  const fullSelect =
    'day, condition, temp_max_c, temp_min_c, precipitation_mm, precip_open_hours_mm, rain_hours_open, is_significant_rain_open'
  const basicSelect = 'day, condition, temp_max_c, temp_min_c, precipitation_mm'

  let data: Record<string, unknown>[] | null = null
  let error: { code?: string; message?: string } | null = null

  const full = await supabaseServer.from('footcounter_daily_weather').select(fullSelect).in('day', days).order('day')
  data = full.data
  error = full.error

  if (
    error &&
    error.code !== 'PGRST205' &&
    (error.message?.includes('precip_open_hours_mm') || error.message?.includes('is_significant_rain_open'))
  ) {
    const basic = await supabaseServer.from('footcounter_daily_weather').select(basicSelect).in('day', days).order('day')
    data = basic.data
    error = basic.error
  }

  if (error) {
    if (error.code !== 'PGRST205') {
      console.error('footcounter month weather:', error)
    }
    if (stats.month_weather?.length) return stats
    return { ...stats, month_weather: [] }
  }

  const byDay = new Map((data ?? []).map(r => [r.day as string, r]))
  const fromRpc = new Map((stats.month_weather ?? []).map(w => [w.day, w]))
  const month_weather = days.map(day => {
    const w = byDay.get(day)
    const rpc = fromRpc.get(day)
    return {
      day,
      condition: (w?.condition as string) ?? rpc?.condition ?? 'unknown',
      temp_max_c: (w?.temp_max_c as number | null) ?? rpc?.temp_max_c ?? null,
      temp_min_c: (w?.temp_min_c as number | null) ?? rpc?.temp_min_c ?? null,
      precipitation_mm: (w?.precipitation_mm as number | null) ?? rpc?.precipitation_mm ?? null,
      precip_open_hours_mm:
        (w?.precip_open_hours_mm as number | null) ?? rpc?.precip_open_hours_mm ?? null,
      rain_hours_open: (w?.rain_hours_open as number | null) ?? rpc?.rain_hours_open ?? null,
      is_significant_rain_open:
        (w?.is_significant_rain_open as boolean | null) ?? rpc?.is_significant_rain_open ?? null
    }
  })

  return { ...stats, month_weather }
}

function normalizeSeriesMonths12(
  raw: FootcounterMonthTrend[] | null | undefined
): FootcounterMonthTrend[] {
  const keys = last12MonthKeys(FOOTCOUNTER_LOCAL_TZ)
  const byKey = new Map((raw ?? []).map(m => [m.month_key, m]))
  return keys.map(month_key => {
    const row = byKey.get(month_key)
    const total_in = Number(row?.total_in) || 0
    const total_out = Number(row?.total_out) || 0
    return {
      month_key,
      total_in,
      total_out,
      total: Number(row?.total) || total_in + total_out
    }
  })
}

export async function attachSeriesMonths12(
  stats: FootcounterDashboardStats,
  deviceSlug: string,
  hoursMode: 'open' | 'all'
): Promise<FootcounterDashboardStats> {
  if (stats.series_months_12?.length === 12) {
    return { ...stats, series_months_12: normalizeSeriesMonths12(stats.series_months_12) }
  }

  const { data, error } = await supabaseServer.rpc('footcounter_series_months_12', {
    p_device_slug: deviceSlug,
    p_hours_mode: hoursMode
  })

  if (!error && data != null) {
    const rows = (Array.isArray(data) ? data : []) as FootcounterMonthTrend[]
    return { ...stats, series_months_12: normalizeSeriesMonths12(rows) }
  }

  if (error && error.code !== 'PGRST202') {
    console.error('footcounter series_months_12:', error)
  }

  // Legacy RPC: pad 6-month payload to 12 slots
  if (stats.series_months_6?.length) {
    return { ...stats, series_months_12: normalizeSeriesMonths12(stats.series_months_6) }
  }

  return { ...stats, series_months_12: normalizeSeriesMonths12([]) }
}

/** Fill insight fields when RPC returns legacy shape or JS fallback. */
export async function enrichFootcounterInsights(
  stats: FootcounterDashboardStats,
  opts?: {
    deviceSlug?: string
    hoursMode?: 'open' | 'all'
    byDay?: Map<string, { in_count: number; out_count: number; weekday_mon0: number }>
    prevMonthIn?: number
  }
): Promise<FootcounterDashboardStats> {
  const live_occupancy =
    stats.live_occupancy ?? Math.max(0, stats.today_in - stats.today_out)

  const peak =
    stats.today_peak_hour != null
      ? { hour: stats.today_peak_hour, in_count: stats.today_peak_in ?? 0 }
      : computePeakHour(stats.series_today_hourly)

  const month_summary = stats.month_summary ?? computeMonthSummary(stats.series_month)

  const mom_change_pct =
    stats.mom_change_pct !== undefined
      ? stats.mom_change_pct
      : opts?.prevMonthIn != null
        ? computeMomChangePct(stats.series_month, opts.prevMonthIn)
        : null

  let weekday_profile = stats.weekday_profile
  if (!weekday_profile?.length && opts?.byDay) {
    const todayKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Budapest',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date())
    weekday_profile = computeWeekdayProfileFromDaily(opts.byDay, 90, todayKey)
  }

  const enriched: FootcounterDashboardStats = {
    ...stats,
    live_occupancy,
    today_peak_hour: peak.hour,
    today_peak_in: peak.in_count,
    month_summary,
    mom_change_pct,
    weekday_profile: weekday_profile ?? [],
    series_months_6: stats.series_months_6 ?? []
  }

  const withYear = opts?.deviceSlug
    ? await attachSeriesMonths12(enriched, opts.deviceSlug, opts.hoursMode ?? 'open')
    : { ...enriched, series_months_12: normalizeSeriesMonths12(stats.series_months_12 ?? stats.series_months_6) }

  return attachMonthWeather(withYear)
}
