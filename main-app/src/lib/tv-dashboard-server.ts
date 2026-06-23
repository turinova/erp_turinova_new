import { supabaseServer } from '@/lib/supabase-server'
import {
  getTodayAttendanceForHome,
  getWeeklyCuttingData,
  getWeeklyEdgeBandingData
} from '@/lib/dashboard-server'
import { getFootcounterDashboardStats, slimFootcounterForHome } from '@/lib/footcounter-stats'
import type {
  TvAttendanceBlock,
  TvAttendanceRow,
  TvAttendanceStatus,
  TvBacklogBlock,
  TvDashboardPayload,
  TvDaySeries,
  TvEdgeSeries,
  TvFootcounterBlock,
  TvFootcounterMood,
  TvMachineLimit,
  TvTodayProductionBlock
} from '@/types/tv-dashboard'

export const TV_EDGE_CAPACITY_PER_DAY = 700

const BUDAPEST_TZ = 'Europe/Budapest'
/** TV charts: Mon–Fri only (no Saturday production) */
const WEEK_DAYS = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek'] as const
const WORK_WEEK_LEN = WEEK_DAYS.length

function trimWorkWeekNumbers(values: number[] | undefined): number[] {
  const src = values || []
  return Array.from({ length: WORK_WEEK_LEN }, (_, i) => roundM(Number(src[i]) || 0))
}

function trimWorkWeekSeries(series: { name: string; data: number[] }[] | undefined) {
  return (series || []).map(ms => ({
    name: ms.name,
    data: trimWorkWeekNumbers(ms.data)
  }))
}

function trimTodayIndex(index: number | null): number | null {
  if (index == null || index >= WORK_WEEK_LEN) return null
  return index
}

function budapestTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUDAPEST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
}

function budapestYesterdayYmd(): string {
  const todayKey = budapestTodayYmd()
  const y = Number(todayKey.slice(0, 4))
  const m = Number(todayKey.slice(5, 7))
  const d = Number(todayKey.slice(8, 10))
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() - 1)
  return dt.toISOString().slice(0, 10)
}

/** Monday=0 … Saturday=5 in Europe/Budapest; Sunday=null */
function budapestTodayWeekIndex(): number | null {
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: BUDAPEST_TZ,
    weekday: 'short'
  }).format(new Date())
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5
  }
  return map[short] ?? null
}

function roundM(n: number): number {
  return Math.round(n * 100) / 100
}

async function fetchBacklogCutting(before: string): Promise<{ meters: number; orderCount: number }> {
  const pageSize = 1000
  let offset = 0
  let total = 0
  const orderIds = new Set<string>()

  while (true) {
    const { data, error } = await supabaseServer
      .from('quotes')
      .select(
        `
        id,
        quote_materials_pricing (
          cutting_length_m
        )
      `
      )
      .lt('production_date', before)
      .not('production_date', 'is', null)
      .is('deleted_at', null)
      .is('cancelled_at', null)
      .is('ready_at', null)
      .is('finished_at', null)
      .order('production_date', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) throw error

    const rows = (data || []) as Array<{
      id: string
      quote_materials_pricing?: Array<{ cutting_length_m?: number | null }>
    }>

    for (const q of rows) {
      orderIds.add(q.id)
      for (const pr of q.quote_materials_pricing || []) {
        const len = Number(pr?.cutting_length_m) || 0
        if (len > 0) total += len
      }
    }

    if (rows.length < pageSize) break
    offset += pageSize
  }

  return { meters: roundM(total), orderCount: orderIds.size }
}

async function fetchBacklogEdge(before: string): Promise<{ meters: number; orderCount: number }> {
  const pageSize = 500
  let offset = 0
  let total = 0
  const orderIds = new Set<string>()

  while (true) {
    const { data, error } = await supabaseServer
      .from('quotes')
      .select(
        `
        id,
        quote_materials_pricing (
          quote_edge_materials_breakdown (
            total_length_m
          )
        )
      `
      )
      .lt('production_date', before)
      .not('production_date', 'is', null)
      .is('deleted_at', null)
      .is('cancelled_at', null)
      .is('ready_at', null)
      .is('finished_at', null)
      .order('production_date', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) throw error

    const rows = (data || []) as Array<{
      id: string
      quote_materials_pricing?: Array<{
        quote_edge_materials_breakdown?: Array<{ total_length_m?: number | null }>
      }>
    }>

    for (const q of rows) {
      let quoteHasEdge = false
      for (const pr of q.quote_materials_pricing || []) {
        for (const e of pr.quote_edge_materials_breakdown || []) {
          const len = Number(e?.total_length_m) || 0
          if (len > 0) {
            total += len
            quoteHasEdge = true
          }
        }
      }
      if (quoteHasEdge) orderIds.add(q.id)
    }

    if (rows.length < pageSize) break
    offset += pageSize
  }

  return { meters: roundM(total), orderCount: orderIds.size }
}

async function getBacklogBlock(): Promise<TvBacklogBlock> {
  const before = budapestYesterdayYmd()
  const [cutting, edge] = await Promise.all([fetchBacklogCutting(before), fetchBacklogEdge(before)])
  return {
    before,
    cuttingM: cutting.meters,
    cuttingOrderCount: cutting.orderCount,
    edgeM: edge.meters,
    edgeOrderCount: edge.orderCount
  }
}

function toDaySeries(
  doneTotals: number[] | undefined,
  remainingTotals: number[] | undefined,
  dailyTotals: number[] | undefined,
  weekStart: string,
  weekEnd: string,
  machineSeries?: { name: string; data: number[] }[],
  machineLimits?: TvMachineLimit[]
): TvDaySeries {
  return {
    categories: [...WEEK_DAYS],
    done: trimWorkWeekNumbers(doneTotals),
    remaining: trimWorkWeekNumbers(remainingTotals),
    totals: trimWorkWeekNumbers(dailyTotals),
    todayIndex: trimTodayIndex(budapestTodayWeekIndex()),
    weekStart,
    weekEnd,
    series: trimWorkWeekSeries(machineSeries),
    machineLimits: machineLimits?.length ? machineLimits : undefined
  }
}

function buildMachineLimits(
  series: { name: string; data: number[] }[] | undefined,
  rawLimits: { machineName: string; limit: number }[] | undefined
): TvMachineLimit[] | undefined {
  if (!series?.length || !rawLimits?.length) return undefined
  return series.map(s => {
    const match = rawLimits.find(l => l.machineName === s.name)
    return { name: s.name, limitM: Number(match?.limit) || 0 }
  })
}

function buildTodayProduction(cutting: TvDaySeries, edge: TvEdgeSeries): TvTodayProductionBlock {
  const idx = cutting.todayIndex
  const empty: TvTodayProductionBlock = {
    cuttingTotalM: 0,
    cuttingDoneM: 0,
    cuttingRemainingM: 0,
    edgeTotalM: 0,
    edgeDoneM: 0,
    edgeRemainingM: 0,
    edgeCapacityM: TV_EDGE_CAPACITY_PER_DAY,
    edgeCapacityPct: null
  }
  if (idx == null) return empty

  const edgeTotal = edge.totals[idx] ?? 0
  const edgeCapacity = edge.capacityPerDay?.[idx] ?? TV_EDGE_CAPACITY_PER_DAY

  return {
    cuttingTotalM: cutting.totals[idx] ?? 0,
    cuttingDoneM: cutting.done[idx] ?? 0,
    cuttingRemainingM: cutting.remaining[idx] ?? 0,
    edgeTotalM: edgeTotal,
    edgeDoneM: edge.done[idx] ?? 0,
    edgeRemainingM: edge.remaining[idx] ?? 0,
    edgeCapacityM: edgeCapacity,
    edgeCapacityPct: edgeCapacity > 0 ? roundM((edgeTotal / edgeCapacity) * 100) : null
  }
}

function parseTimeToMinutes(t: string | null): number | null {
  if (!t || !String(t).trim()) return null
  const s = String(t).trim()
  const parts = s.split(':')
  if (parts.length < 2) return null
  const h = Number(parts[0])
  const m = Number(parts[1])
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

function attendanceStatus(
  arrival: string | null,
  departure: string | null,
  holidayType: 'Szabadság' | 'Betegszabadság' | null,
  shiftStart: string | null
): { status: TvAttendanceStatus; label: string; isLate: boolean } {
  if (holidayType === 'Szabadság') return { status: 'holiday', label: 'Szabadság', isLate: false }
  if (holidayType === 'Betegszabadság') return { status: 'sick', label: 'Betegszabadság', isLate: false }
  if (!arrival && departure) return { status: 'odd', label: 'Ellenőrizendő', isLate: false }
  if (!arrival && !departure) return { status: 'none', label: 'Nincs jelentés', isLate: false }
  if (arrival && departure) return { status: 'left', label: 'Távozott', isLate: false }

  const shiftMin = parseTimeToMinutes(shiftStart)
  const arrivalMin = parseTimeToMinutes(arrival)
  const isLate = shiftMin != null && arrivalMin != null && arrivalMin > shiftMin + 5
  if (isLate) return { status: 'late', label: 'Késő', isLate: true }
  return { status: 'in', label: 'Bent', isLate: false }
}

const ATTENDANCE_RANK: Record<TvAttendanceStatus, number> = {
  in: 0,
  late: 1,
  left: 2,
  holiday: 3,
  sick: 4,
  none: 5,
  odd: 6
}

async function getAttendanceBlock(): Promise<TvAttendanceBlock> {
  const raw = await getTodayAttendanceForHome()
  const employees: TvAttendanceRow[] = raw.employees.map(emp => {
    const { status, label, isLate } = attendanceStatus(
      emp.arrival,
      emp.departure,
      emp.holiday_type,
      emp.shift_start_time
    )
    return {
      id: emp.id,
      name: emp.name,
      arrival: emp.arrival,
      departure: emp.departure,
      status,
      statusLabel: label,
      holidayName: emp.holiday_name,
      shiftStart: emp.shift_start_time,
      isLate
    }
  })

  employees.sort((a, b) => {
    const ra = ATTENDANCE_RANK[a.status]
    const rb = ATTENDANCE_RANK[b.status]
    if (ra !== rb) return ra - rb
    return a.name.localeCompare(b.name, 'hu')
  })

  const counts = {
    in: employees.filter(e => e.status === 'in').length,
    left: employees.filter(e => e.status === 'left').length,
    holiday: employees.filter(e => e.status === 'holiday' || e.status === 'sick').length,
    none: employees.filter(e => e.status === 'none').length,
    odd: employees.filter(e => e.status === 'odd').length,
    late: employees.filter(e => e.status === 'late').length
  }

  return { dateLabel: raw.dateLabel, counts, employees }
}

function footcounterMood(
  todayIn: number,
  avgIn: number | null
): { mood: TvFootcounterMood; label: string; subtitle: string | null } {
  if (!avgIn || avgIn <= 0) {
    if (todayIn > 0) {
      return { mood: 'no_baseline', label: `${todayIn} belépő ma`, subtitle: null }
    }
    return { mood: 'no_baseline', label: 'Nincs mai adat', subtitle: null }
  }
  const pct = Math.round((todayIn / avgIn - 1) * 100)
  if (Math.abs(pct) <= 10) {
    return { mood: 'typical', label: 'Szokásos nap', subtitle: 'az átlag körül' }
  }
  if (pct > 10) {
    return { mood: 'busy', label: 'Erős forgalom', subtitle: `+${pct}% az átlaghoz képest` }
  }
  return { mood: 'quiet', label: 'Enyhe forgalom', subtitle: `${pct}% az átlaghoz képest` }
}

async function getFootcounterBlock(): Promise<TvFootcounterBlock | null> {
  try {
    const slug = process.env.FOOTCOUNTER_STATS_DEVICE_SLUG?.trim() || 'default'
    const stats = await getFootcounterDashboardStats(slug)
    const slim = slimFootcounterForHome(stats)
    const avgIn = slim.same_weekday_avg?.avg_in ?? null
    const mood = footcounterMood(slim.today_in, avgIn)

    const hourStart = 8
    const hourEnd = 17
    const hourlyOpen: number[] = []
    const hourLabels: number[] = []
    for (let h = hourStart; h <= hourEnd; h++) {
      hourLabels.push(h)
      hourlyOpen.push(slim.hourly_in[h] ?? 0)
    }

    const dayLabels = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']
    const heatmapData: Array<[number, number, number]> = []
    const matrix = stats.heatmap_in?.matrix
    if (matrix && matrix.length >= 7) {
      for (let dayRow = 0; dayRow < 7; dayRow++) {
        const row = matrix[dayRow] || []
        for (let h = hourStart; h <= hourEnd; h++) {
          const hourCol = h - hourStart
          const val = Number(row[h]) || 0
          if (val > 0) heatmapData.push([hourCol, dayRow, val])
        }
      }
    }

    const seenMin =
      slim.device_last_seen != null
        ? (Date.now() - new Date(slim.device_last_seen).getTime()) / 60_000
        : null
    const online = seenMin != null && seenMin <= 20

    return {
      todayIn: slim.today_in,
      todayOut: slim.today_out,
      mood: mood.mood,
      moodLabel: mood.label,
      moodSubtitle: mood.subtitle,
      online,
      hourlyOpen,
      hourLabels,
      heatmap:
        heatmapData.length > 0
          ? { dayLabels, hours: hourLabels, data: heatmapData }
          : null,
      avgIn
    }
  } catch {
    return null
  }
}

export async function getTvDashboardPayload(): Promise<TvDashboardPayload> {
  const [backlog, weeklyCuttingRaw, weeklyEdgeRaw, attendance, footcounter] = await Promise.all([
    getBacklogBlock(),
    getWeeklyCuttingData(0),
    getWeeklyEdgeBandingData(0),
    getAttendanceBlock(),
    getFootcounterBlock()
  ])

  const cuttingLimits = buildMachineLimits(
    weeklyCuttingRaw.series,
    weeklyCuttingRaw.machineLimits?.map(l => ({ machineName: l.machineName, limit: l.limit }))
  )

  const weeklyCutting = toDaySeries(
    weeklyCuttingRaw.doneTotals,
    weeklyCuttingRaw.remainingTotals,
    weeklyCuttingRaw.dailyTotals,
    weeklyCuttingRaw.weekStart || '',
    weeklyCuttingRaw.weekEnd || '',
    weeklyCuttingRaw.series || [],
    cuttingLimits
  )

  const weeklyEdge: TvEdgeSeries = {
    ...toDaySeries(
      weeklyEdgeRaw.doneTotals,
      weeklyEdgeRaw.remainingTotals,
      weeklyEdgeRaw.dailyTotals,
      weeklyEdgeRaw.weekStart || '',
      weeklyEdgeRaw.weekEnd || '',
      weeklyEdgeRaw.series || []
    ),
    capacityPerDay: trimWorkWeekNumbers(
      weeklyEdgeRaw.capacityPerDay || Array(WORK_WEEK_LEN).fill(TV_EDGE_CAPACITY_PER_DAY)
    )
  }

  return {
    generatedAt: new Date().toISOString(),
    todayProduction: buildTodayProduction(weeklyCutting, weeklyEdge),
    backlog,
    weeklyCutting,
    weeklyEdge,
    attendance,
    footcounter
  }
}
