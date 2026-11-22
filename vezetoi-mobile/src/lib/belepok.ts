import type { SupabaseClient } from '@supabase/supabase-js'

import {
  addDaysYmd,
  budapestTodayYmd,
  budapestYearMonth,
  MONTH_NAMES_HU
} from '@/lib/date'

export type BelepokOpenHours = {
  weekdayOpen: number
  weekdayClose: number
  saturdayOpen: number | null
  saturdayClose: number | null
}

export type BelepokLiveStatus = 'live' | 'idle' | 'offline' | 'none'

export type BelepokGlance = {
  todayIn: number
  todayOut: number
  netInside: number
  peakHour: number | null
  peakCount: number
  hourStart: number
  hourEnd: number
  closed: boolean
  hoursLabel: string
  hourlyInSlice: { hour: number; count: number }[]
  liveStatus: BelepokLiveStatus
}

export type BelepokPeriod = 'today' | 'week' | 'month'

export type BelepokChartBar = {
  label: string
  value: number
  highlight?: boolean
}

export type BelepokPageModel = {
  period: BelepokPeriod
  liveStatus: BelepokLiveStatus
  heroValue: number
  heroSuffix: string
  /** Egy sor a hero alatt (ügyvezető scan). */
  heroHint: string
  /** Opcionális egy detail sor a chart alatt. */
  detailLine: string | null
  bars: BelepokChartBar[]
  emptyMessage: string | null
  year: number
  month: number
  monthLabel: string
  canGoNextMonth: boolean
  canGoPrevMonth: boolean
  loadError: string | null
}

const DEFAULT_HOURS: BelepokOpenHours = {
  weekdayOpen: 8,
  weekdayClose: 17,
  saturdayOpen: 8,
  saturdayClose: 12
}

const MONTH_SHORT = [
  'jan',
  'feb',
  'már',
  'ápr',
  'máj',
  'jún',
  'júl',
  'aug',
  'szep',
  'okt',
  'nov',
  'dec'
] as const

type DashboardAgg = {
  empty?: boolean
  today_in_by_hour?: unknown
  today_out_by_hour?: unknown
  month_days?: Array<{ d?: number; c?: number }>
  month_hours?: Array<{ h?: number; c?: number }>
  lookback_days?: Array<{ day_key?: string; c?: number }>
  prev_month_total_in?: number
}

function clampHour(n: unknown, fallback: number): number {
  const v = Number(n)
  if (!Number.isInteger(v) || v < 0 || v > 23) return fallback
  return v
}

function asIntArray(raw: unknown, len: number): number[] {
  const out = Array.from({ length: len }, () => 0)
  if (!Array.isArray(raw)) return out
  for (let i = 0; i < len; i++) {
    const n = Number(raw[i])
    out[i] = Number.isFinite(n) && n > 0 ? Math.round(n) : 0
  }
  return out
}

function isoWeekdayFromYmd(ymd: string): number {
  const dow = new Date(`${ymd}T12:00:00Z`).getUTCDay()
  return (dow + 6) % 7
}

function todayDisplayRange(
  hours: BelepokOpenHours,
  weekday: number
): { open: number; close: number; closed: boolean } {
  if (weekday === 6) {
    return { open: hours.weekdayOpen, close: hours.weekdayClose, closed: true }
  }
  if (weekday === 5) {
    if (hours.saturdayOpen == null || hours.saturdayClose == null) {
      return {
        open: hours.weekdayOpen,
        close: hours.weekdayClose,
        closed: true
      }
    }
    return {
      open: hours.saturdayOpen,
      close: hours.saturdayClose,
      closed: false
    }
  }
  return {
    open: hours.weekdayOpen,
    close: hours.weekdayClose,
    closed: false
  }
}

function sumHourSlice(hourly: number[], open: number, close: number): number {
  let s = 0
  for (let h = open; h <= close; h++) s += hourly[h] ?? 0
  return s
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function fmt(n: number): string {
  return n.toLocaleString('hu-HU')
}

function shiftMonth(
  year: number,
  month: number,
  delta: number
): { year: number; month: number } {
  let y = year
  let m = month + delta
  while (m < 1) {
    m += 12
    y -= 1
  }
  while (m > 12) {
    m -= 12
    y += 1
  }
  return { year: y, month: m }
}

async function loadOpenHours(
  supabase: SupabaseClient,
  tenantId: string
): Promise<BelepokOpenHours> {
  const { data, error } = await supabase
    .from('footcounter_settings')
    .select(
      'weekday_open_hour, weekday_close_hour, saturday_open_hour, saturday_close_hour'
    )
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error || !data) return { ...DEFAULT_HOURS }

  const weekdayOpen = clampHour(
    data.weekday_open_hour,
    DEFAULT_HOURS.weekdayOpen
  )
  const weekdayClose = clampHour(
    data.weekday_close_hour,
    DEFAULT_HOURS.weekdayClose
  )

  let saturdayOpen: number | null = null
  let saturdayClose: number | null = null
  if (data.saturday_open_hour != null && data.saturday_close_hour != null) {
    saturdayOpen = clampHour(data.saturday_open_hour, 8)
    saturdayClose = clampHour(data.saturday_close_hour, 12)
  }

  return {
    weekdayOpen: Math.min(weekdayOpen, weekdayClose),
    weekdayClose: Math.max(weekdayOpen, weekdayClose),
    saturdayOpen,
    saturdayClose
  }
}

async function loadLiveStatus(
  supabase: SupabaseClient,
  tenantId: string
): Promise<BelepokLiveStatus> {
  const { data, error } = await supabase
    .from('footcounter_devices')
    .select('last_seen_at')
    .eq('tenant_id', tenantId)

  if (error || !data?.length) return 'none'

  let latest: string | null = null
  for (const r of data) {
    const at = r.last_seen_at as string | null
    if (!at) continue
    if (!latest || new Date(at).getTime() > new Date(latest).getTime()) {
      latest = at
    }
  }
  if (!latest) return 'offline'

  const ageMs = Date.now() - new Date(latest).getTime()
  if (ageMs <= 30 * 60 * 1000) return 'live'
  if (ageMs <= 24 * 60 * 60 * 1000) return 'idle'
  return 'offline'
}

/** Home glance — ugyanaz az RPC, mint a web `/home` Belépők kártya. */
export async function getBelepokGlance(
  supabase: SupabaseClient,
  tenantId: string
): Promise<BelepokGlance> {
  const [openHours, liveStatus, slim] = await Promise.all([
    loadOpenHours(supabase, tenantId),
    loadLiveStatus(supabase, tenantId),
    supabase.rpc('footcounter_today_slim_agg', { p_tenant_id: tenantId })
  ])

  const today = budapestTodayYmd()
  const wd = isoWeekdayFromYmd(today)
  const range = todayDisplayRange(openHours, wd)

  if (slim.error) {
    console.error('footcounter_today_slim_agg', slim.error.message)
    return {
      todayIn: 0,
      todayOut: 0,
      netInside: 0,
      peakHour: null,
      peakCount: 0,
      hourStart: range.open,
      hourEnd: range.close,
      closed: range.closed,
      hoursLabel: `${range.open}–${range.close}`,
      hourlyInSlice: [],
      liveStatus
    }
  }

  const row = (slim.data ?? {}) as {
    hourly_in?: unknown
    hourly_out?: unknown
  }

  const hourlyIn = asIntArray(row.hourly_in, 24)
  const hourlyOut = asIntArray(row.hourly_out, 24)

  const todayIn = range.closed
    ? 0
    : sumHourSlice(hourlyIn, range.open, range.close)
  const todayOut = range.closed
    ? 0
    : sumHourSlice(hourlyOut, range.open, range.close)

  const hourlyInSlice: { hour: number; count: number }[] = []
  let peakHour: number | null = null
  let peakCount = 0
  if (!range.closed) {
    for (let h = range.open; h <= range.close; h++) {
      const count = hourlyIn[h] ?? 0
      hourlyInSlice.push({ hour: h, count })
      if (count > peakCount) {
        peakCount = count
        peakHour = h
      }
    }
  }

  return {
    todayIn,
    todayOut,
    netInside: Math.max(0, todayIn - todayOut),
    peakHour: peakCount > 0 ? peakHour : null,
    peakCount,
    hourStart: range.open,
    hourEnd: range.close,
    closed: range.closed,
    hoursLabel: `${range.open}–${range.close}`,
    hourlyInSlice,
    liveStatus
  }
}

function buildTodayModel(
  glance: BelepokGlance,
  year: number,
  month: number
): BelepokPageModel {
  const bars: BelepokChartBar[] = glance.hourlyInSlice.map((p) => ({
    label:
      p.hour === glance.hourStart ||
      p.hour === glance.hourEnd ||
      p.hour === 12
        ? String(p.hour)
        : '',
    value: p.count,
    highlight: p.hour === glance.peakHour
  }))

  const empty = glance.closed
    ? 'Ma zárva.'
    : glance.todayIn === 0
      ? 'Ma még senki.'
      : null

  const detail =
    glance.peakHour != null && glance.peakCount > 0
      ? `Csúcs ${String(glance.peakHour).padStart(2, '0')}:00 · ${fmt(glance.peakCount)}`
      : glance.closed
        ? null
        : `Nyitás ${glance.hoursLabel}`

  return {
    period: 'today',
    liveStatus: glance.liveStatus,
    heroValue: glance.todayIn,
    heroSuffix: 'belépő',
    heroHint: glance.closed
      ? 'Zárva a nyitvatartás szerint'
      : `Kilépő ${fmt(glance.todayOut)} · bent ${fmt(glance.netInside)}`,
    detailLine: detail,
    bars,
    emptyMessage: empty,
    year,
    month,
    monthLabel: `${year}. ${MONTH_NAMES_HU[month - 1]}`,
    canGoNextMonth: false,
    canGoPrevMonth: false,
    loadError: null
  }
}

function buildWeekModel(
  agg: DashboardAgg,
  liveStatus: BelepokLiveStatus,
  year: number,
  month: number
): BelepokPageModel {
  const today = budapestTodayYmd()
  const keys: string[] = []
  for (let i = 6; i >= 0; i--) keys.push(addDaysYmd(today, -i))

  const map = new Map<string, number>()
  for (const row of agg.lookback_days ?? []) {
    const key = String(row.day_key ?? '')
    const c = Number(row.c) || 0
    if (key) map.set(key, c)
  }

  const bars: BelepokChartBar[] = keys.map((ymd) => {
    const day = Number(ymd.slice(8, 10))
    const value = map.get(ymd) ?? 0
    return {
      label: String(day),
      value,
      highlight: ymd === today
    }
  })

  const total = bars.reduce((s, b) => s + b.value, 0)
  const active = bars.filter((b) => b.value > 0)
  const avg = active.length > 0 ? Math.round(total / active.length) : 0
  let best = bars[0]
  for (const b of bars) {
    if (b.value > (best?.value ?? 0)) best = b
  }

  const detail =
    best && best.value > 0
      ? `Legjobb nap ${best.label}. · ${fmt(best.value)}`
      : null

  return {
    period: 'week',
    liveStatus,
    heroValue: total,
    heroSuffix: 'belépő',
    heroHint: avg > 0 ? `Átlag ${fmt(avg)} / nap` : 'Elmúlt 7 nap',
    detailLine: detail,
    bars,
    emptyMessage: total === 0 ? 'Az elmúlt 7 napban senki.' : null,
    year,
    month,
    monthLabel: `${year}. ${MONTH_NAMES_HU[month - 1]}`,
    canGoNextMonth: false,
    canGoPrevMonth: false,
    loadError: null
  }
}

function buildMonthModel(
  agg: DashboardAgg,
  liveStatus: BelepokLiveStatus,
  year: number,
  month: number
): BelepokPageModel {
  const now = budapestYearMonth()
  const dim = daysInMonth(year, month)
  const counts = new Map<number, number>()
  for (const row of agg.month_days ?? []) {
    const d = Number(row.d)
    const c = Number(row.c) || 0
    if (Number.isInteger(d)) counts.set(d, c)
  }

  const bars: BelepokChartBar[] = []
  let total = 0
  let activeDays = 0
  let bestDay = 0
  let bestCount = 0
  for (let day = 1; day <= dim; day++) {
    const value = counts.get(day) ?? 0
    total += value
    if (value > 0) activeDays += 1
    if (value > bestCount) {
      bestCount = value
      bestDay = day
    }
    const showLabel = day === 1 || day === 15 || day === dim
    bars.push({
      label: showLabel ? String(day) : '',
      value,
      highlight: day === bestDay && value > 0
    })
  }

  const avg = activeDays > 0 ? Math.round(total / activeDays) : 0
  const prev = Number(agg.prev_month_total_in) || 0
  const mom =
    prev > 0 ? Math.round((total / prev - 1) * 100) : null

  let peakHour: number | null = null
  let peakBest = 0
  for (const row of agg.month_hours ?? []) {
    const h = Number(row.h)
    const c = Number(row.c) || 0
    if (Number.isInteger(h) && c > peakBest) {
      peakBest = c
      peakHour = h
    }
  }

  const canGoNext =
    year < now.year || (year === now.year && month < now.month)
  const canGoPrev = year > 2024 || (year === 2024 && month > 1)

  const hintParts: string[] = []
  if (mom != null) hintParts.push(`vs előző hó ${mom > 0 ? '+' : ''}${mom}%`)
  else if (avg > 0) hintParts.push(`Átlag ${fmt(avg)} / nap`)
  if (activeDays > 0 && mom != null) {
    hintParts.push(`${activeDays} nap`)
  }

  const detail =
    bestDay > 0 && bestCount > 0
      ? `Legjobb ${bestDay}. · ${fmt(bestCount)}${
          peakHour != null
            ? ` · csúcs ${String(peakHour).padStart(2, '0')}:00`
            : ''
        }`
      : null

  return {
    period: 'month',
    liveStatus,
    heroValue: total,
    heroSuffix: 'belépő',
    heroHint: hintParts.join(' · ') || `${MONTH_SHORT[month - 1]}`,
    detailLine: detail,
    bars,
    emptyMessage: total === 0 ? 'Ebben a hónapban senki.' : null,
    year,
    month,
    monthLabel: `${year}. ${MONTH_NAMES_HU[month - 1]}`,
    canGoNextMonth: canGoNext,
    canGoPrevMonth: canGoPrev,
    loadError: null
  }
}

/** Belépők tab — Ma / Hét / Hó egy oldal. */
export async function getBelepokPage(
  supabase: SupabaseClient,
  tenantId: string,
  period: BelepokPeriod,
  year: number,
  month: number
): Promise<BelepokPageModel> {
  const now = budapestYearMonth()
  const y = year || now.year
  const m = month || now.month

  if (period === 'today') {
    const glance = await getBelepokGlance(supabase, tenantId)
    return buildTodayModel(glance, now.year, now.month)
  }

  const rpcYear = period === 'week' ? now.year : y
  const rpcMonth = period === 'week' ? now.month : m

  const [liveStatus, rpc] = await Promise.all([
    loadLiveStatus(supabase, tenantId),
    supabase.rpc('footcounter_dashboard_agg', {
      p_tenant_id: tenantId,
      p_year: rpcYear,
      p_month: rpcMonth
    })
  ])

  if (rpc.error) {
    console.error('footcounter_dashboard_agg', rpc.error.message)
    return {
      period,
      liveStatus,
      heroValue: 0,
      heroSuffix: 'belépő',
      heroHint: '',
      detailLine: null,
      bars: [],
      emptyMessage: null,
      year: rpcYear,
      month: rpcMonth,
      monthLabel: `${rpcYear}. ${MONTH_NAMES_HU[rpcMonth - 1]}`,
      canGoNextMonth: false,
      canGoPrevMonth: false,
      loadError: 'Nem sikerült betölteni a Belépők adatokat.'
    }
  }

  const agg = (rpc.data ?? {}) as DashboardAgg
  if (period === 'week') {
    return buildWeekModel(agg, liveStatus, now.year, now.month)
  }

  return buildMonthModel(agg, liveStatus, y, m)
}

export function belepokShiftMonth(
  year: number,
  month: number,
  delta: -1 | 1
): { year: number; month: number } {
  return shiftMonth(year, month, delta)
}
