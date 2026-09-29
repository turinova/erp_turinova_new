import type { SupabaseClient } from '@supabase/supabase-js'

import {
  FOOTCOUNTER_WEEKDAY_LABELS,
  MONTH_SHORT_HU
} from '@/lib/footcounter/chart-tokens'
import type {
  FootcounterHeatmapRow,
  FootcounterMonthDayBar,
  FootcounterSeasonBar,
  FootcounterTodayHourBar,
  FootcounterTodayPanelData,
  FootcounterWeekdayBar
} from '@/lib/footcounter/chart-types'
import {
  DEFAULT_FOOTCOUNTER_OPEN_HOURS,
  isHourClosed,
  peakHourInRange,
  sumHourSlice,
  todayDisplayRange,
  type FootcounterOpenHours
} from '@/lib/footcounter/open-hours'
import { getFootcounterOpenHours } from '@/lib/footcounter/settings-queries'
import {
  buildTodayMood,
  type FootcounterTodayGlance
} from '@/lib/footcounter/summary'
import type {
  FootcounterDeviceRow,
  FootcounterHomeSlim,
  FootcounterMonthDay
} from '@/lib/footcounter/types'

export async function listFootcounterDevicesForTenant(
  admin: SupabaseClient,
  tenantId: string
): Promise<FootcounterDeviceRow[]> {
  const { data, error } = await admin
    .from('footcounter_devices')
    .select(
      'id, tenant_id, slug, name, sync_token_hash, stream_url, last_seen_at, created_at, updated_at'
    )
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('listFootcounterDevicesForTenant', error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    slug: row.slug as string,
    name: (row.name as string) || (row.slug as string),
    stream_url: (row.stream_url as string | null) ?? null,
    last_seen_at: (row.last_seen_at as string | null) ?? null,
    has_token: Boolean(row.sync_token_hash),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string
  }))
}

function budapestDayKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d)
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** ISO hét napja: 0 = hétfő … 6 = vasárnap (Budapest naptári nap). */
function isoWeekdayFromDayKey(dayKey: string): number {
  const dow = new Date(`${dayKey}T12:00:00Z`).getUTCDay()
  return (dow + 6) % 7
}

function hourClosed(
  weekday: number,
  hour: number,
  hours: FootcounterOpenHours
): boolean {
  return isHourClosed(weekday, hour, hours)
}

function asIntArray(raw: unknown, len: number): number[] {
  const out = Array.from({ length: len }, () => 0)
  if (!Array.isArray(raw)) return out
  for (let i = 0; i < len; i++) {
    const v = Number(raw[i])
    out[i] = Number.isFinite(v) ? v : 0
  }
  return out
}

type DashboardAgg = {
  empty?: boolean
  today_in_by_hour?: unknown
  today_out_by_hour?: unknown
  today_in?: number
  today_out?: number
  month_days?: Array<{ d?: number; c?: number }>
  month_hours?: Array<{ h?: number; c?: number }>
  season_months?: Array<{ ym?: string; c?: number }>
  heat_days?: Array<{ day_key?: string; h?: number; c?: number }>
  lookback_days?: Array<{ day_key?: string; c?: number }>
  prev_month_total_in?: number
}

async function rpcDashboardAgg(
  supabase: SupabaseClient,
  tenantId: string,
  year: number,
  month: number
): Promise<DashboardAgg | null> {
  const { data, error } = await supabase.rpc('footcounter_dashboard_agg', {
    p_tenant_id: tenantId,
    p_year: year,
    p_month: month
  })
  if (error) {
    console.error('footcounter_dashboard_agg', error.message)
    return null
  }
  return (data ?? null) as DashboardAgg | null
}

export type FootcounterMonthInsResult = {
  days: FootcounterMonthDay[]
  peakHour: number | null
  peakHourIn: number
  totalIn: number
}

/**
 * Belépők (IN) naponta + havi csúcsóra — a dashboard RPC month slice-ából
 * (prev hónap MoM-hoz; ha nincs RPC, üres).
 */
export async function getFootcounterMonthIns(
  supabase: SupabaseClient,
  tenantId: string,
  year: number,
  month: number
): Promise<FootcounterMonthInsResult> {
  const dim = daysInMonth(year, month)
  const empty: FootcounterMonthDay[] = Array.from({ length: dim }, (_, i) => ({
    day: i + 1,
    count: 0
  }))

  const agg = await rpcDashboardAgg(supabase, tenantId, year, month)
  if (!agg || agg.empty) {
    return { days: empty, peakHour: null, peakHourIn: 0, totalIn: 0 }
  }

  const counts = new Map<number, number>()
  for (const row of agg.month_days ?? []) {
    const d = Number(row.d)
    const c = Number(row.c)
    if (Number.isInteger(d) && d >= 1 && d <= dim) {
      counts.set(d, Number.isFinite(c) ? c : 0)
    }
  }

  const days = empty.map((row) => ({
    day: row.day,
    count: counts.get(row.day) ?? 0
  }))
  const totalIn = days.reduce((s, d) => s + d.count, 0)

  let peakHour: number | null = null
  let peakHourIn = 0
  for (const row of agg.month_hours ?? []) {
    const h = Number(row.h)
    const c = Number(row.c)
    if (!Number.isInteger(h) || !Number.isFinite(c)) continue
    if (c > peakHourIn) {
      peakHourIn = c
      peakHour = h
    }
  }

  return { days, peakHour, peakHourIn, totalIn }
}

/** Mai belépők + hangulat + mai csúcsóra (dashboard lookback slice). */
export async function getFootcounterTodayGlance(
  supabase: SupabaseClient,
  tenantId: string
): Promise<FootcounterTodayGlance> {
  const empty: FootcounterTodayGlance = {
    todayIn: 0,
    mood: 'none',
    moodLabel: 'Nincs mai adat',
    moodHint: null,
    peakHour: null,
    peakHourIn: 0
  }

  const now = new Date()
  const year = Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Budapest',
      year: 'numeric'
    }).format(now)
  )
  const month = Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Budapest',
      month: 'numeric'
    }).format(now)
  )

  const agg = await rpcDashboardAgg(supabase, tenantId, year, month)
  if (!agg || agg.empty) return empty

  const todayKey = budapestDayKey(now)
  const todayIn = Number(agg.today_in) || 0
  const todayHours = asIntArray(agg.today_in_by_hour, 24)

  let peakHour: number | null = null
  let peakHourIn = 0
  for (let h = 0; h < 24; h++) {
    const c = todayHours[h] ?? 0
    if (c > peakHourIn) {
      peakHourIn = c
      peakHour = h
    }
  }

  const todayDow = isoWeekdayFromDayKey(todayKey)
  const samples: number[] = []
  for (const row of agg.lookback_days ?? []) {
    const key = String(row.day_key ?? '')
    const count = Number(row.c) || 0
    if (!key || count <= 0) continue
    if (isoWeekdayFromDayKey(key) !== todayDow) continue
    samples.push(count)
  }
  const sameWeekdayAvg =
    samples.length > 0
      ? samples.reduce((a, b) => a + b, 0) / samples.length
      : null

  const mood = buildTodayMood(todayIn, sameWeekdayAvg, samples.length)

  return {
    todayIn,
    ...mood,
    peakHour,
    peakHourIn
  }
}

export async function getFootcounterLiveStatus(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{
  status: 'live' | 'idle' | 'offline' | 'none'
  lastSeenAt: string | null
  deviceCount: number
}> {
  const { data, error } = await supabase
    .from('footcounter_devices')
    .select('last_seen_at')
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('getFootcounterLiveStatus', error.message)
    return { status: 'none', lastSeenAt: null, deviceCount: 0 }
  }

  const rows = data ?? []
  if (rows.length === 0) {
    return { status: 'none', lastSeenAt: null, deviceCount: 0 }
  }

  let latest: string | null = null
  for (const r of rows) {
    const at = r.last_seen_at as string | null
    if (!at) continue
    if (!latest || new Date(at).getTime() > new Date(latest).getTime()) {
      latest = at
    }
  }

  if (!latest) {
    return { status: 'offline', lastSeenAt: null, deviceCount: rows.length }
  }

  const ageMs = Date.now() - new Date(latest).getTime()
  const LIVE_MS = 30 * 60 * 1000
  const IDLE_MS = 24 * 60 * 60 * 1000

  let status: 'live' | 'idle' | 'offline' = 'offline'
  if (ageMs <= LIVE_MS) status = 'live'
  else if (ageMs <= IDLE_MS) status = 'idle'

  return { status, lastSeenAt: latest, deviceCount: rows.length }
}

/**
 * Home widget adat: mai IN/OUT + órás IN (0–23) + élő státusz.
 * KPI / chart a tenant nyitvatartására szűrve (display-only).
 */
export async function getFootcounterHomeSlim(
  supabase: SupabaseClient,
  tenantId: string
): Promise<FootcounterHomeSlim> {
  const empty: FootcounterHomeSlim = {
    todayIn: 0,
    todayOut: 0,
    hourlyIn: Array.from({ length: 24 }, () => 0),
    hourlyOut: Array.from({ length: 24 }, () => 0),
    lastEventAt: null,
    deviceLastSeen: null,
    liveStatus: 'none',
    openHours: { ...DEFAULT_FOOTCOUNTER_OPEN_HOURS }
  }

  const [live, openHours, slim] = await Promise.all([
    getFootcounterLiveStatus(supabase, tenantId),
    getFootcounterOpenHours(supabase, tenantId),
    supabase.rpc('footcounter_today_slim_agg', { p_tenant_id: tenantId })
  ])

  if (slim.error) {
    console.error('footcounter_today_slim_agg', slim.error.message)
    return {
      ...empty,
      liveStatus: live.status,
      deviceLastSeen: live.lastSeenAt,
      openHours
    }
  }

  const row = (slim.data ?? {}) as {
    today_in?: number
    today_out?: number
    hourly_in?: unknown
    hourly_out?: unknown
    last_event_at?: string | null
  }

  const hourlyIn = asIntArray(row.hourly_in, 24)
  const hourlyOut = asIntArray(row.hourly_out, 24)
  const todayKey = budapestDayKey(new Date())
  const wd = isoWeekdayFromDayKey(todayKey)
  const range = todayDisplayRange(openHours, wd)

  const todayIn = range.closed
    ? 0
    : sumHourSlice(hourlyIn, range.open, range.close)
  const todayOut = range.closed
    ? 0
    : sumHourSlice(hourlyOut, range.open, range.close)

  return {
    todayIn,
    todayOut,
    hourlyIn,
    hourlyOut,
    lastEventAt: row.last_event_at ?? null,
    deviceLastSeen: live.lastSeenAt,
    liveStatus: live.status,
    openHours
  }
}

export async function getFootcounterTodayStats(
  supabase: SupabaseClient,
  tenantId: string
): Promise<
  Array<{
    deviceId: string
    slug: string
    name: string
    lastSeenAt: string | null
    todayIn: number
    todayOut: number
  }>
> {
  const { data, error } = await supabase.rpc('footcounter_today_by_device_agg', {
    p_tenant_id: tenantId
  })

  if (error) {
    console.error('footcounter_today_by_device_agg', error.message)
    return []
  }

  const rows = (Array.isArray(data) ? data : []) as Array<{
    device_id?: string
    slug?: string
    name?: string
    last_seen_at?: string | null
    today_in?: number
    today_out?: number
  }>

  return rows.map((d) => ({
    deviceId: String(d.device_id ?? ''),
    slug: String(d.slug ?? ''),
    name: String(d.name ?? d.slug ?? ''),
    lastSeenAt: d.last_seen_at ?? null,
    todayIn: Number(d.today_in) || 0,
    todayOut: Number(d.today_out) || 0
  }))
}

export type FootcounterDashboardBundle = {
  today: FootcounterTodayPanelData
  monthDays: FootcounterMonthDayBar[]
  weekdayProfile: FootcounterWeekdayBar[]
  season: FootcounterSeasonBar[]
  heatmap: FootcounterHeatmapRow[]
  monthPeakHour: number | null
  monthPeakHourIn: number
  /** Előző naptári hónap összes IN — MoM glance. */
  prevMonthTotalIn: number
  openHours: FootcounterOpenHours
  /** RPC hiba (pl. migráció hiányzik). */
  loadError?: string
}

/**
 * Teljes /belepok dashboard adat — egy RPC aggregátum roundtrip.
 */
export async function getFootcounterDashboard(
  supabase: SupabaseClient,
  tenantId: string,
  year: number,
  month: number
): Promise<FootcounterDashboardBundle> {
  const [live, agg, openHours] = await Promise.all([
    getFootcounterLiveStatus(supabase, tenantId),
    rpcDashboardAgg(supabase, tenantId, year, month),
    getFootcounterOpenHours(supabase, tenantId)
  ])
  const emptyToday = buildEmptyTodayPanel(live.status === 'live', openHours)
  const emptyDays: FootcounterMonthDayBar[] = Array.from(
    { length: daysInMonth(year, month) },
    (_, i) => {
      const day = i + 1
      const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const wd = isoWeekdayFromDayKey(key)
      return { day, inCount: 0, closed: wd === 6 }
    }
  )
  const emptyWeekday: FootcounterWeekdayBar[] = FOOTCOUNTER_WEEKDAY_LABELS.map(
    (label, weekday) => ({
      weekday,
      label,
      avgIn: 0,
      closed: weekday === 6
    })
  )
  const emptySeason = buildEmptySeason(year, month)
  const emptyHeatmap = buildEmptyHeatmap(openHours)
  const emptyBundle: FootcounterDashboardBundle = {
    today: emptyToday,
    monthDays: emptyDays,
    weekdayProfile: emptyWeekday,
    season: emptySeason,
    heatmap: emptyHeatmap,
    monthPeakHour: null,
    monthPeakHourIn: 0,
    prevMonthTotalIn: 0,
    openHours
  }

  if (!agg) {
    return {
      ...emptyBundle,
      loadError:
        'A Belépők összesítő RPC nem elérhető. Futtasd a 20260557_footcounter_dashboard_agg migrációt.'
    }
  }
  if (agg.empty) return emptyBundle

  const todayKey = budapestDayKey(new Date())
  const currentHour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Budapest',
      hour: '2-digit',
      hourCycle: 'h23'
    })
      .formatToParts(new Date())
      .find((p) => p.type === 'hour')?.value ?? 0
  )

  const todayHourlyIn = asIntArray(agg.today_in_by_hour, 24)
  const todayHourlyOut = asIntArray(agg.today_out_by_hour, 24)
  const todayWd = isoWeekdayFromDayKey(todayKey)
  const todayRange = todayDisplayRange(openHours, todayWd)
  const todayIn = todayRange.closed
    ? 0
    : sumHourSlice(todayHourlyIn, todayRange.open, todayRange.close)
  const todayOut = todayRange.closed
    ? 0
    : sumHourSlice(todayHourlyOut, todayRange.open, todayRange.close)

  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`
  const monthDayCounts = new Map<number, number>()
  for (const row of agg.month_days ?? []) {
    const d = Number(row.d)
    const c = Number(row.c)
    if (Number.isInteger(d) && Number.isFinite(c)) monthDayCounts.set(d, c)
  }

  const monthHourCounts = new Map<number, number>()
  for (const row of agg.month_hours ?? []) {
    const h = Number(row.h)
    const c = Number(row.c)
    if (Number.isInteger(h) && Number.isFinite(c)) monthHourCounts.set(h, c)
  }

  const seasonTotals = new Map<string, number>()
  for (const row of agg.season_months ?? []) {
    const ym = String(row.ym ?? '')
    const c = Number(row.c)
    if (ym && Number.isFinite(c)) seasonTotals.set(ym, c)
  }

  const heatDayHours = new Map<string, Map<number, number>>()
  for (const row of agg.heat_days ?? []) {
    const key = String(row.day_key ?? '')
    const h = Number(row.h)
    const c = Number(row.c)
    if (!key || !Number.isInteger(h) || !Number.isFinite(c)) continue
    if (!heatDayHours.has(key)) heatDayHours.set(key, new Map())
    heatDayHours.get(key)!.set(h, c)
  }

  const weekdaySums = Array.from({ length: 7 }, () => 0)
  const weekdaySamples = Array.from({ length: 7 }, () => 0)

  const dim = daysInMonth(year, month)
  let peakDay = 0
  let peakDayCount = 0
  for (let day = 1; day <= dim; day++) {
    const key = `${monthPrefix}-${String(day).padStart(2, '0')}`
    const wd = isoWeekdayFromDayKey(key)
    const count = monthDayCounts.get(day) ?? 0
    if (count > 0) {
      weekdaySums[wd]! += count
      weekdaySamples[wd]! += 1
    }
    if (count > peakDayCount) {
      peakDayCount = count
      peakDay = day
    }
  }

  const monthDays: FootcounterMonthDayBar[] = Array.from(
    { length: dim },
    (_, i) => {
      const day = i + 1
      const key = `${monthPrefix}-${String(day).padStart(2, '0')}`
      const wd = isoWeekdayFromDayKey(key)
      const inCount = monthDayCounts.get(day) ?? 0
      return {
        day,
        inCount,
        closed: wd === 6 || inCount === 0,
        highlight: day === peakDay && inCount > 0
      }
    }
  )

  const weekdayProfile: FootcounterWeekdayBar[] =
    FOOTCOUNTER_WEEKDAY_LABELS.map((label, weekday) => {
      const samples = weekdaySamples[weekday] ?? 0
      const sum = weekdaySums[weekday] ?? 0
      const closed = weekday === 6 || samples === 0
      return {
        weekday,
        label,
        avgIn: samples > 0 ? Math.round(sum / samples) : 0,
        closed
      }
    })

  const season = buildSeasonBars(year, month, seasonTotals)

  const heatAccum: Array<Array<{ sum: number; n: number }>> = Array.from(
    { length: 7 },
    () => Array.from({ length: 24 }, () => ({ sum: 0, n: 0 }))
  )
  for (const [dayKey, hours] of heatDayHours) {
    const wd = isoWeekdayFromDayKey(dayKey)
    for (let h = 0; h < 24; h++) {
      const v = hours.get(h) ?? 0
      heatAccum[wd]![h]!.sum += v
      heatAccum[wd]![h]!.n += 1
    }
  }

  const heatmap: FootcounterHeatmapRow[] = FOOTCOUNTER_WEEKDAY_LABELS.map(
    (label, weekday) => {
      const cells = []
      for (
        let hour = openHours.weekdayOpen;
        hour <= openHours.weekdayClose;
        hour++
      ) {
        const closed = hourClosed(weekday, hour, openHours)
        const cell = heatAccum[weekday]![hour]!
        const value =
          closed || cell.n === 0 ? 0 : Math.round(cell.sum / cell.n)
        cells.push({ hour, value, closed })
      }
      const total = cells.reduce((s, c) => s + c.value, 0)
      return {
        weekday,
        label,
        cells,
        total,
        closed: weekday === 6 || total === 0
      }
    }
  )

  const chartOpen = todayRange.closed
    ? openHours.weekdayOpen
    : todayRange.open
  const chartClose = todayRange.closed
    ? openHours.weekdayClose
    : todayRange.close

  const hourly: FootcounterTodayHourBar[] = []
  for (let hour = chartOpen; hour <= chartClose; hour++) {
    const pending = todayRange.closed || hour > currentHour
    const running = !todayRange.closed && hour === currentHour
    hourly.push({
      hour,
      inCount: pending ? 0 : (todayHourlyIn[hour] ?? 0),
      outCount: pending ? 0 : (todayHourlyOut[hour] ?? 0),
      pending,
      running
    })
  }

  const todayPeak = peakHourInRange(todayHourlyIn, chartOpen, chartClose)
  const peakHour = todayRange.closed ? null : todayPeak.hour
  const peakHourIn = todayRange.closed ? 0 : todayPeak.count

  const todayDow = todayWd
  const samples: number[] = []
  for (const row of agg.lookback_days ?? []) {
    const key = String(row.day_key ?? '')
    const count = Number(row.c) || 0
    if (!key || count <= 0) continue
    if (isoWeekdayFromDayKey(key) !== todayDow) continue
    samples.push(count)
  }
  const weekdayAvg =
    samples.length > 0
      ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
      : null

  const todayLabel = new Intl.DateTimeFormat('hu-HU', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  }).format(new Date())

  const today: FootcounterTodayPanelData = {
    label: todayLabel,
    todayIn,
    todayOut,
    occupancy: Math.max(0, todayIn - todayOut),
    peakHour,
    peakHourIn,
    weekdayAvg,
    weekdayAvgLabel: `${FOOTCOUNTER_WEEKDAY_LABELS[todayDow] ?? 'Napi'} átlag`,
    hourly,
    live: live.status === 'live'
  }

  let monthPeakHour: number | null = null
  let monthPeakHourIn = 0
  for (const [h, c] of monthHourCounts) {
    if (h < openHours.weekdayOpen || h > openHours.weekdayClose) continue
    if (c > monthPeakHourIn) {
      monthPeakHourIn = c
      monthPeakHour = h
    }
  }

  return {
    today,
    monthDays,
    weekdayProfile,
    season,
    heatmap,
    monthPeakHour,
    monthPeakHourIn,
    prevMonthTotalIn: Number(agg.prev_month_total_in) || 0,
    openHours
  }
}

function buildEmptyTodayPanel(
  live: boolean,
  hours: FootcounterOpenHours = DEFAULT_FOOTCOUNTER_OPEN_HOURS
): FootcounterTodayPanelData {
  const hourly: FootcounterTodayHourBar[] = []
  for (let hour = hours.weekdayOpen; hour <= hours.weekdayClose; hour++) {
    hourly.push({ hour, inCount: 0, outCount: 0, pending: false })
  }
  return {
    label: 'Ma',
    todayIn: 0,
    todayOut: 0,
    occupancy: 0,
    peakHour: null,
    peakHourIn: 0,
    weekdayAvg: null,
    weekdayAvgLabel: 'Napi átlag',
    hourly,
    live
  }
}

function buildEmptySeason(year: number, month: number): FootcounterSeasonBar[] {
  return buildSeasonBars(year, month, new Map())
}

function buildSeasonBars(
  year: number,
  month: number,
  totals: Map<string, number>
): FootcounterSeasonBar[] {
  const out: FootcounterSeasonBar[] = []
  for (let i = 11; i >= 0; i--) {
    let y = year
    let m = month - i
    while (m <= 0) {
      m += 12
      y -= 1
    }
    const key = `${y}-${String(m).padStart(2, '0')}`
    out.push({
      key,
      label: MONTH_SHORT_HU[m - 1] ?? key,
      totalIn: totals.get(key) ?? 0,
      selected: i === 0
    })
  }
  return out
}

function buildEmptyHeatmap(
  hours: FootcounterOpenHours = DEFAULT_FOOTCOUNTER_OPEN_HOURS
): FootcounterHeatmapRow[] {
  return FOOTCOUNTER_WEEKDAY_LABELS.map((label, weekday) => {
    const cells = []
    for (let hour = hours.weekdayOpen; hour <= hours.weekdayClose; hour++) {
      cells.push({
        hour,
        value: 0,
        closed: hourClosed(weekday, hour, hours)
      })
    }
    return {
      weekday,
      label,
      cells,
      total: 0,
      closed: weekday === 6
    }
  })
}
