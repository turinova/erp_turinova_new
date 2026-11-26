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

const DEFAULT_HOURS: BelepokOpenHours = {
  weekdayOpen: 8,
  weekdayClose: 17,
  saturdayOpen: 8,
  saturdayClose: 12
}


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

export type BelepokDevice = {
  status: BelepokLiveStatus
  lastSeenAt: string | null
}

async function loadDevice(
  supabase: SupabaseClient,
  tenantId: string
): Promise<BelepokDevice> {
  const { data, error } = await supabase
    .from('footcounter_devices')
    .select('last_seen_at')
    .eq('tenant_id', tenantId)

  if (error || !data?.length) return { status: 'none', lastSeenAt: null }

  let latest: string | null = null
  for (const r of data) {
    const at = r.last_seen_at as string | null
    if (!at) continue
    if (!latest || new Date(at).getTime() > new Date(latest).getTime()) {
      latest = at
    }
  }
  if (!latest) return { status: 'offline', lastSeenAt: null }

  const ageMs = Date.now() - new Date(latest).getTime()
  const status: BelepokLiveStatus =
    ageMs <= 30 * 60 * 1000 ? 'live' : ageMs <= 24 * 60 * 60 * 1000 ? 'idle' : 'offline'
  return { status, lastSeenAt: latest }
}

/** Home glance — ugyanaz az RPC, mint a web `/home` Belépők kártya. */
export async function getBelepokGlance(
  supabase: SupabaseClient,
  tenantId: string
): Promise<BelepokGlance> {
  const [openHours, device, slim] = await Promise.all([
    loadOpenHours(supabase, tenantId),
    loadDevice(supabase, tenantId),
    supabase.rpc('footcounter_today_slim_agg', { p_tenant_id: tenantId })
  ])

  const today = budapestTodayYmd()
  const wd = isoWeekdayFromYmd(today)
  const range = todayDisplayRange(openHours, wd)
  const liveStatus = device.status

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

const WEEKDAY_ON_HU = [
  'hétfőn',
  'kedden',
  'szerdán',
  'csütörtökön',
  'pénteken',
  'szombaton',
  'vasárnap'
] as const

const WEEKDAY_NAME_HU = [
  'hétfő',
  'kedd',
  'szerda',
  'csütörtök',
  'péntek',
  'szombat',
  'vasárnap'
] as const

const WEEKDAY_SHORT_HU = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'] as const

export type BelepokMood = {
  text: string
  tone: 'muted' | 'success' | 'warning'
}

export type BelepokHourBar = {
  hour: number
  /** null = jövőbeli óra. */
  value: number | null
  isNow: boolean
}

export type BelepokToday = {
  device: BelepokDevice
  closed: boolean
  openLabel: string
  todayIn: number
  insideNow: number
  peakHour: number | null
  peakCount: number
  hours: BelepokHourBar[]
  mood: BelepokMood | null
  /** Pl. „Egy átlagos kedden egész nap 140 fő jön.” */
  typicalLine: string | null
  /** Egy átlagos ugyanilyen nap eddig (zárás után: egész nap); nincs minta → null. */
  typicalUntil: number | null
}

export type BelepokDayBar = {
  ymd: string
  label: string
  title: string
  value: number
  highlight: boolean
}

export type BelepokWeek = {
  device: BelepokDevice
  total: number
  prevTotal: number
  days: BelepokDayBar[]
  best: BelepokDayBar | null
  avgOpenDay: number
}

export type BelepokWeekdayAvg = {
  weekday: number
  label: string
  name: string
  avg: number
  samples: number
}

export type BelepokMonth = {
  device: BelepokDevice
  year: number
  month: number
  monthLabel: string
  total: number
  prevTotal: number
  openDays: number
  avgOpenDay: number
  days: BelepokDayBar[]
  best: BelepokDayBar | null
  peakHour: number | null
  weekdays: BelepokWeekdayAvg[]
  canGoPrevMonth: boolean
  canGoNextMonth: boolean
}

function budapestHourNow(): number {
  const h = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Budapest',
    hour: '2-digit',
    hourCycle: 'h23'
  }).format(new Date())
  return Number(h) % 24
}

async function dashboardAgg(
  supabase: SupabaseClient,
  tenantId: string,
  year: number,
  month: number
): Promise<DashboardAgg> {
  const { data, error } = await supabase.rpc('footcounter_dashboard_agg', {
    p_tenant_id: tenantId,
    p_year: year,
    p_month: month
  })
  if (error) {
    console.error('footcounter_dashboard_agg', error.message)
    throw new Error('Nem sikerült betölteni a Belépők adatokat.')
  }
  return (data ?? {}) as DashboardAgg
}

function lookbackMap(agg: DashboardAgg): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of agg.lookback_days ?? []) {
    const key = String(row.day_key ?? '')
    if (key) map.set(key, Number(row.c) || 0)
  }
  return map
}

function moodFrom(current: number, typical: number, against: string): BelepokMood {
  const pct = Math.round((current / typical - 1) * 100)
  if (Math.abs(pct) <= 10) {
    return { text: `Szokásos nap: nagyjából annyi, mint ${against}`, tone: 'muted' }
  }
  return pct > 0
    ? { text: `▲ Erős forgalom: ${pct}%-kal több, mint ${against}`, tone: 'success' }
    : {
        text: `▼ Csendesebb nap: ${Math.abs(pct)}%-kal kevesebb, mint ${against}`,
        tone: 'warning'
      }
}

/** Ma: óránként, bent most, csúcsóra, ítélet a hét ugyanazon napjához mérve. */
export async function getBelepokToday(
  supabase: SupabaseClient,
  tenantId: string
): Promise<BelepokToday> {
  const now = budapestYearMonth()
  const [openHours, device, agg] = await Promise.all([
    loadOpenHours(supabase, tenantId),
    loadDevice(supabase, tenantId),
    dashboardAgg(supabase, tenantId, now.year, now.month)
  ])

  const today = budapestTodayYmd()
  const wd = isoWeekdayFromYmd(today)
  const range = todayDisplayRange(openHours, wd)
  const hourlyIn = asIntArray(agg.today_in_by_hour, 24)
  const hourlyOut = asIntArray(agg.today_out_by_hour, 24)
  const nowHour = budapestHourNow()
  const openLabel = `${range.open}–${range.close}`

  if (range.closed) {
    return {
      device,
      closed: true,
      openLabel,
      todayIn: 0,
      insideNow: 0,
      peakHour: null,
      peakCount: 0,
      hours: [],
      mood: null,
      typicalLine: null,
      typicalUntil: null
    }
  }

  const todayIn = sumHourSlice(hourlyIn, range.open, range.close)
  const todayOut = sumHourSlice(hourlyOut, range.open, range.close)
  const hours: BelepokHourBar[] = []
  let peakHour: number | null = null
  let peakCount = 0
  for (let h = range.open; h <= range.close; h++) {
    const v = hourlyIn[h] ?? 0
    hours.push({ hour: h, value: h > nowHour ? null : v, isNow: h === nowHour })
    if (v > peakCount) {
      peakCount = v
      peakHour = h
    }
  }

  // Ugyanaz a hét napja: teljes napi átlag a 70 napos visszatekintésből.
  const look = lookbackMap(agg)
  const sameDayTotals: number[] = []
  for (const [key, c] of look) {
    if (c > 0 && isoWeekdayFromYmd(key) === wd) sameDayTotals.push(c)
  }
  const recent = sameDayTotals.slice(-8)
  const typicalDay =
    recent.length > 0 ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : null

  // „Ilyenkor”: e havi azonos napok, a lezárt órákig (heat_days).
  const cutoff = Math.min(nowHour, range.close + 1)
  const byDay = new Map<string, number>()
  for (const row of (agg as { heat_days?: Array<{ day_key?: string; h?: number; c?: number }> })
    .heat_days ?? []) {
    const key = String(row.day_key ?? '')
    const h = Number(row.h)
    if (!key || key >= today || isoWeekdayFromYmd(key) !== wd) continue
    if (!Number.isInteger(h) || h < range.open || h >= cutoff) continue
    byDay.set(key, (byDay.get(key) ?? 0) + (Number(row.c) || 0))
  }
  const samples = [...byDay.values()].filter((v) => v > 0)
  let todayUntil = 0
  for (let h = range.open; h < cutoff; h++) todayUntil += hourlyIn[h] ?? 0

  const dayOn = WEEKDAY_ON_HU[wd]
  let mood: BelepokMood | null = null
  let typicalUntil: number | null = null
  if (cutoff > range.open && samples.length > 0) {
    const avgUntil = samples.reduce((a, b) => a + b, 0) / samples.length
    const against = nowHour > range.close ? `egy átlagos ${dayOn}` : `egy átlagos ${dayOn} ilyenkor`
    if (avgUntil > 0) {
      mood = moodFrom(todayUntil, avgUntil, against)
      typicalUntil = Math.round(avgUntil)
    }
  } else if (nowHour > range.close && typicalDay) {
    mood = moodFrom(todayIn, typicalDay, `egy átlagos ${dayOn}`)
    typicalUntil = typicalDay
  }

  return {
    device,
    closed: false,
    openLabel,
    todayIn,
    insideNow: Math.max(0, todayIn - todayOut),
    peakHour: peakCount > 0 ? peakHour : null,
    peakCount,
    hours,
    mood,
    typicalLine: typicalDay
      ? `Egy átlagos ${WEEKDAY_ON_HU[wd]} egész nap ${fmt(typicalDay)} fő jön.`
      : null,
    typicalUntil
  }
}

const WEEKDAY_ALLATIVE_HU = [
  'hétfőhöz',
  'keddhez',
  'szerdához',
  'csütörtökhöz',
  'péntekhez',
  'szombathoz',
  'vasárnaphoz'
] as const

export type BelepokPeriodGlance = {
  /** Ma: zárva van a bolt. */
  closed: boolean
  value: number
  compare: number | null
  compareLabel: string
}

/**
 * Kezdőlap csempe: Ma (vs. szokásos ilyenkor), Hét (hétfőtől vs. múlt hét azonos napjai),
 * Hónap (1-jétől vs. előző hónap 1–N.). A visszatekintő napi sor (70 nap) mindkét hónapot lefedi.
 */
export async function getBelepokPeriodGlance(
  supabase: SupabaseClient,
  tenantId: string,
  period: 'ma' | 'het' | 'honap'
): Promise<BelepokPeriodGlance> {
  const today = budapestTodayYmd()
  const wd = isoWeekdayFromYmd(today)

  if (period === 'ma') {
    const t = await getBelepokToday(supabase, tenantId)
    return {
      closed: t.closed,
      value: t.todayIn,
      compare: t.typicalUntil,
      compareLabel: `a szokásos ${WEEKDAY_ALLATIVE_HU[wd]} képest`
    }
  }

  const now = budapestYearMonth()
  const [openHours, agg] = await Promise.all([
    loadOpenHours(supabase, tenantId),
    dashboardAgg(supabase, tenantId, now.year, now.month)
  ])
  const look = lookbackMap(agg)
  const range = todayDisplayRange(openHours, wd)
  look.set(
    today,
    range.closed ? 0 : sumHourSlice(asIntArray(agg.today_in_by_hour, 24), range.open, range.close)
  )
  const sum = (from: string, to: string): number => {
    let s = 0
    for (let d = from; d <= to; d = addDaysYmd(d, 1)) s += look.get(d) ?? 0
    return s
  }

  if (period === 'het') {
    const monday = addDaysYmd(today, -wd)
    const lastMonday = addDaysYmd(monday, -7)
    return {
      closed: false,
      value: sum(monday, today),
      compare: sum(lastMonday, addDaysYmd(today, -7)),
      compareLabel: 'a múlt hét azonos napjaihoz képest'
    }
  }

  const day = Number(today.slice(8, 10))
  const prev = shiftMonth(now.year, now.month, -1)
  const prevDays = Math.min(day, daysInMonth(prev.year, prev.month))
  const prevPrefix = `${prev.year}-${String(prev.month).padStart(2, '0')}`
  const prevShort = MONTH_NAMES_HU[prev.month - 1].slice(0, 3).toLowerCase()
  return {
    closed: false,
    value: sum(`${today.slice(0, 8)}01`, today),
    compare: sum(`${prevPrefix}-01`, `${prevPrefix}-${String(prevDays).padStart(2, '0')}`),
    compareLabel: `${prevShort}. 1–${prevDays}.-hoz képest`
  }
}

function dayTitle(ymd: string): string {
  const [, m, d] = ymd.split('-').map(Number)
  const name = WEEKDAY_NAME_HU[isoWeekdayFromYmd(ymd)]
  return `${MONTH_NAMES_HU[m - 1]} ${d}., ${name}`
}

function bestOf(days: BelepokDayBar[]): BelepokDayBar | null {
  let best: BelepokDayBar | null = null
  for (const d of days) if (d.value > 0 && (!best || d.value > best.value)) best = d
  return best
}

/** 7 nap: ma + előző 6 nap, összevetve az azt megelőző 7 nappal. */
export async function getBelepokWeek(
  supabase: SupabaseClient,
  tenantId: string
): Promise<BelepokWeek> {
  const now = budapestYearMonth()
  const [openHours, device, agg] = await Promise.all([
    loadOpenHours(supabase, tenantId),
    loadDevice(supabase, tenantId),
    dashboardAgg(supabase, tenantId, now.year, now.month)
  ])
  const today = budapestTodayYmd()
  const look = lookbackMap(agg)
  const range = todayDisplayRange(openHours, isoWeekdayFromYmd(today))
  const todayIn = range.closed
    ? 0
    : sumHourSlice(asIntArray(agg.today_in_by_hour, 24), range.open, range.close)
  look.set(today, todayIn)

  const days: BelepokDayBar[] = []
  for (let i = 6; i >= 0; i--) {
    const ymd = addDaysYmd(today, -i)
    days.push({
      ymd,
      label: WEEKDAY_SHORT_HU[isoWeekdayFromYmd(ymd)],
      title: ymd === today ? `Ma, ${dayTitle(ymd)}` : dayTitle(ymd),
      value: look.get(ymd) ?? 0,
      highlight: ymd === today
    })
  }
  let prevTotal = 0
  for (let i = 13; i >= 7; i--) prevTotal += look.get(addDaysYmd(today, -i)) ?? 0

  const total = days.reduce((s, d) => s + d.value, 0)
  const open = days.filter((d) => d.value > 0)
  return {
    device,
    total,
    prevTotal,
    days,
    best: bestOf(days),
    avgOpenDay: open.length ? Math.round(total / open.length) : 0
  }
}

/** Hónap: napi bontás, előző hónap, hét napja profil. */
export async function getBelepokMonth(
  supabase: SupabaseClient,
  tenantId: string,
  year: number,
  month: number
): Promise<BelepokMonth> {
  const now = budapestYearMonth()
  const [device, agg] = await Promise.all([
    loadDevice(supabase, tenantId),
    dashboardAgg(supabase, tenantId, year, month)
  ])
  const today = budapestTodayYmd()
  const dim = daysInMonth(year, month)
  const counts = new Map<number, number>()
  for (const row of agg.month_days ?? []) {
    const d = Number(row.d)
    if (Number.isInteger(d)) counts.set(d, Number(row.c) || 0)
  }

  const prefix = `${year}-${String(month).padStart(2, '0')}`
  const days: BelepokDayBar[] = []
  const wdSum = Array.from({ length: 7 }, () => 0)
  const wdN = Array.from({ length: 7 }, () => 0)
  for (let day = 1; day <= dim; day++) {
    const ymd = `${prefix}-${String(day).padStart(2, '0')}`
    if (ymd > today) break
    const value = counts.get(day) ?? 0
    const wd = isoWeekdayFromYmd(ymd)
    if (value > 0) {
      wdSum[wd] += value
      wdN[wd] += 1
    }
    days.push({
      ymd,
      label: String(day),
      title: dayTitle(ymd),
      value,
      highlight: false
    })
  }
  const best = bestOf(days)
  if (best) best.highlight = true

  const total = days.reduce((s, d) => s + d.value, 0)
  const openDays = days.filter((d) => d.value > 0).length

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

  const weekdays: BelepokWeekdayAvg[] = WEEKDAY_SHORT_HU.map((label, wd) => ({
    weekday: wd,
    label,
    name: WEEKDAY_NAME_HU[wd],
    avg: wdN[wd] > 0 ? Math.round(wdSum[wd] / wdN[wd]) : 0,
    samples: wdN[wd]
  })).filter((w) => w.weekday < 6 || w.samples > 0)

  return {
    device,
    year,
    month,
    monthLabel: `${year}. ${MONTH_NAMES_HU[month - 1].toLowerCase()}`,
    total,
    prevTotal: Number(agg.prev_month_total_in) || 0,
    openDays,
    avgOpenDay: openDays ? Math.round(total / openDays) : 0,
    days,
    best,
    peakHour: peakBest > 0 ? peakHour : null,
    weekdays,
    canGoPrevMonth: year > 2026 || (year === 2026 && month > 1),
    canGoNextMonth: year < now.year || (year === now.year && month < now.month)
  }
}

export function belepokShiftMonth(
  year: number,
  month: number,
  delta: -1 | 1
): { year: number; month: number } {
  return shiftMonth(year, month, delta)
}
