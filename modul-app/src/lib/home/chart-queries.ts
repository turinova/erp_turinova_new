import type { SupabaseClient } from '@supabase/supabase-js'

import {
  MONTH_LABELS_HU,
  WEEKDAY_LABELS_HU,
  budapestTodayYmd,
  budapestYear,
  budapestYesterdayYmd,
  isMondayToFridayYmd,
  mondayIndexFromYmd,
  mondayOfWeek,
  saturdayOfWeek,
  toBudapestYmdFromIso
} from '@/lib/home/date'
import type { QuoteStatus } from '@/lib/quotes/queries'

export type BacklogMeters = {
  cuttingM: number
  edgeM: number
}

export type WeeklyCuttingData = {
  categories: string[]
  series: Array<{ name: string; data: number[] }>
  machineLimits: Array<{
    machineId: string
    machineName: string
    limit: number
  }>
  dailyTotals: number[]
  doneTotals: number[]
  remainingTotals: number[]
  weekStart: string
  weekEnd: string
  weekOffset: number
  /** Hány megrendelés esik a hétre (gép+dátummal). */
  orderCount: number
  /** 'm' ha van szabásméter, különben 'db' fallback. */
  unit: 'm' | 'db'
}

export type WeeklyEdgeData = {
  categories: string[]
  series: Array<{ name: string; data: number[] }>
  dailyTotals: number[]
  capacityPerDayM: number
  weekStart: string
  weekEnd: string
  weekOffset: number
  orderCount: number
  unit: 'm' | 'db'
}

export type YearlyMachineAvgData = {
  year: number
  categories: string[]
  series: Array<{
    machineId: string
    name: string
    dailyLimitM: number
    data: number[]
  }>
}

export type HomeOrderRow = {
  id: string
  order_number: string
  status: QuoteStatus
  customer_name: string
  production_machine_name: string | null
  production_date: string | null
  bucket: 'overdue' | 'today' | 'upcoming' | 'undated'
}

const EDGE_CAPACITY_PER_DAY_M = 700

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function isDone(readyAt: string | null, finishedAt: string | null) {
  return Boolean(readyAt || finishedAt)
}

async function sumMetersForQuotes(
  supabase: SupabaseClient,
  quoteIds: string[]
): Promise<Map<string, { cutting: number; edge: number }>> {
  const map = new Map<string, { cutting: number; edge: number }>()
  if (quoteIds.length === 0) return map

  const { data, error } = await supabase
    .from('quote_material_lines')
    .select('quote_id, cutting_length_m, edge_length_m')
    .in('quote_id', quoteIds)

  if (error) {
    console.error('sumMetersForQuotes', error.message)
    return map
  }

  for (const row of data ?? []) {
    const prev = map.get(row.quote_id) ?? { cutting: 0, edge: 0 }
    prev.cutting += Number(row.cutting_length_m) || 0
    prev.edge += Number(row.edge_length_m) || 0
    map.set(row.quote_id, prev)
  }
  return map
}

/** Elmaradás: gyártási dátum ≤ tegnap, még nincs ready/finished. */
export async function getBacklogMeters(
  supabase: SupabaseClient,
  tenantId: string
): Promise<BacklogMeters> {
  const before = budapestYesterdayYmd()

  const { data, error } = await supabase
    .from('quotes')
    .select('id, ready_at, finished_at')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .not('order_number', 'is', null)
    .not('production_date', 'is', null)
    .lte('production_date', before)
    .neq('status', 'cancelled')

  if (error) {
    console.error('getBacklogMeters', error.message)
    throw new Error('Elmaradás betöltése sikertelen.')
  }

  const open = (data ?? []).filter(
    (q) => !isDone(q.ready_at as string | null, q.finished_at as string | null)
  )
  const meters = await sumMetersForQuotes(
    supabase,
    open.map((q) => q.id)
  )

  let cuttingM = 0
  let edgeM = 0
  for (const m of meters.values()) {
    cuttingM += m.cutting
    edgeM += m.edge
  }

  return { cuttingM: round1(cuttingM), edgeM: round1(edgeM) }
}

export async function getWeeklyCutting(
  supabase: SupabaseClient,
  tenantId: string,
  weekOffset = 0
): Promise<WeeklyCuttingData> {
  const monday = mondayOfWeek(budapestTodayYmd(), weekOffset)
  const saturday = saturdayOfWeek(monday)

  const { data: weeklyData, error } = await supabase
    .from('quotes')
    .select(
      `
      id,
      production_date,
      production_machine_id,
      ready_at,
      finished_at,
      status
    `
    )
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .not('production_machine_id', 'is', null)
    .gte('production_date', monday)
    .lte('production_date', saturday)

  if (error) {
    console.error('getWeeklyCutting', error.message)
    throw new Error('Heti szabás betöltése sikertelen.')
  }

  const quotes = weeklyData ?? []
  const meters = await sumMetersForQuotes(
    supabase,
    quotes.map((q) => q.id)
  )

  const machineIds = [
    ...new Set(
      quotes
        .map((q) => q.production_machine_id as string | null)
        .filter((id): id is string => Boolean(id))
    )
  ]

  const { data: machines } =
    machineIds.length > 0
      ? await supabase
          .from('production_machines')
          .select('id, name, usage_limit_per_day')
          .eq('tenant_id', tenantId)
          .in('id', machineIds)
      : { data: [] as Array<{ id: string; name: string; usage_limit_per_day: number }> }

  const machineMap = new Map(
    (machines ?? []).map((m) => [
      m.id,
      { name: m.name as string, limit: Number(m.usage_limit_per_day) || 0 }
    ])
  )

  const byDateMachine = new Map<string, Map<string, number>>()
  const byDateMachineCount = new Map<string, Map<string, number>>()
  const doneByDate = new Map<string, number>()
  const remainingByDate = new Map<string, number>()

  for (const quote of quotes) {
    const date = quote.production_date as string | null
    const machineId = quote.production_machine_id as string | null
    if (!date || !machineId) continue

    const cutting = meters.get(quote.id)?.cutting ?? 0
    const done = isDone(
      quote.ready_at as string | null,
      quote.finished_at as string | null
    )

    if (done) {
      doneByDate.set(date, (doneByDate.get(date) ?? 0) + cutting)
    } else {
      remainingByDate.set(date, (remainingByDate.get(date) ?? 0) + cutting)
    }

    if (!byDateMachine.has(date)) byDateMachine.set(date, new Map())
    const dayMap = byDateMachine.get(date)!
    dayMap.set(machineId, (dayMap.get(machineId) ?? 0) + cutting)

    if (!byDateMachineCount.has(date)) byDateMachineCount.set(date, new Map())
    const countMap = byDateMachineCount.get(date)!
    countMap.set(machineId, (countMap.get(machineId) ?? 0) + 1)
  }

  const totalCutting = [...byDateMachine.values()].reduce((sum, dayMap) => {
    for (const v of dayMap.values()) sum += v
    return sum
  }, 0)
  const useDb = totalCutting <= 0 && quotes.length > 0
  const sourceMap = useDb ? byDateMachineCount : byDateMachine

  const seriesData: Record<string, number[]> = {}
  for (const id of machineIds) {
    seriesData[id] = [0, 0, 0, 0, 0, 0]
  }

  for (const [dateStr, machineData] of sourceMap) {
    const idx = mondayIndexFromYmd(dateStr)
    if (idx === null || idx > 5) continue
    for (const [machineId, val] of machineData) {
      if (seriesData[machineId]) {
        seriesData[machineId][idx] = useDb
          ? (seriesData[machineId][idx] + val)
          : round1(seriesData[machineId][idx] + val)
      }
    }
  }

  const series = machineIds.map((machineId) => ({
    name: machineMap.get(machineId)?.name ?? `Gép ${machineId.slice(0, 8)}`,
    data: seriesData[machineId] ?? [0, 0, 0, 0, 0, 0]
  }))

  const dailyTotals = [0, 0, 0, 0, 0, 0]
  for (const data of Object.values(seriesData)) {
    data.forEach((v, i) => {
      dailyTotals[i] += v
    })
  }

  const doneTotals = [0, 0, 0, 0, 0, 0]
  const remainingTotals = [0, 0, 0, 0, 0, 0]
  if (!useDb) {
    for (const [dateStr, val] of doneByDate) {
      const idx = mondayIndexFromYmd(dateStr)
      if (idx === null || idx > 5) continue
      doneTotals[idx] += val
    }
    for (const [dateStr, val] of remainingByDate) {
      const idx = mondayIndexFromYmd(dateStr)
      if (idx === null || idx > 5) continue
      remainingTotals[idx] += val
    }
  }

  return {
    categories: [...WEEKDAY_LABELS_HU],
    series,
    machineLimits: useDb
      ? []
      : machineIds.map((machineId) => ({
          machineId,
          machineName: machineMap.get(machineId)?.name ?? 'Gép',
          limit: machineMap.get(machineId)?.limit ?? 0
        })),
    dailyTotals: dailyTotals.map((v) => (useDb ? v : round1(v))),
    doneTotals: doneTotals.map(round1),
    remainingTotals: remainingTotals.map(round1),
    weekStart: monday,
    weekEnd: saturday,
    weekOffset,
    orderCount: quotes.length,
    unit: useDb ? 'db' : 'm'
  }
}

export async function getWeeklyEdge(
  supabase: SupabaseClient,
  tenantId: string,
  weekOffset = 0
): Promise<WeeklyEdgeData> {
  const monday = mondayOfWeek(budapestTodayYmd(), weekOffset)
  const saturday = saturdayOfWeek(monday)

  const { data: weeklyQuotes, error } = await supabase
    .from('quotes')
    .select('id, production_date, status')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .not('production_date', 'is', null)
    .gte('production_date', monday)
    .lte('production_date', saturday)

  if (error) {
    console.error('getWeeklyEdge', error.message)
    throw new Error('Heti élzárás betöltése sikertelen.')
  }

  const quotes = weeklyQuotes ?? []
  const quoteIds = quotes.map((q) => q.id)

  // Élanyag szerinti bontás
  const edgeByName = new Map<string, number[]>()
  const dailyTotals = [0, 0, 0, 0, 0, 0]

  if (quoteIds.length > 0) {
    const { data: materialLines } = await supabase
      .from('quote_material_lines')
      .select('id, quote_id')
      .in('quote_id', quoteIds)

    const lineToQuote = new Map(
      (materialLines ?? []).map((l) => [l.id, l.quote_id as string])
    )
    const lineIds = (materialLines ?? []).map((l) => l.id)

    if (lineIds.length > 0) {
      const { data: edgeLines } = await supabase
        .from('quote_edge_lines')
        .select('quote_material_line_id, edge_name, length_m')
        .in('quote_material_line_id', lineIds)

      const quoteDate = new Map(
        quotes.map((q) => [q.id, q.production_date as string])
      )

      for (const edge of edgeLines ?? []) {
        const quoteId = lineToQuote.get(edge.quote_material_line_id)
        if (!quoteId) continue
        const date = quoteDate.get(quoteId)
        if (!date) continue
        const idx = mondayIndexFromYmd(date)
        if (idx === null || idx > 5) continue

        const name = (edge.edge_name as string) || 'Élzáró'
        if (!edgeByName.has(name)) {
          edgeByName.set(name, [0, 0, 0, 0, 0, 0])
        }
        const arr = edgeByName.get(name)!
        const len = Number(edge.length_m) || 0
        arr[idx] = round1(arr[idx] + len)
        dailyTotals[idx] = round1(dailyTotals[idx] + len)
      }
    }

    // Fallback: ha nincs edge line, material line edge_length_m
    if (edgeByName.size === 0) {
      const meters = await sumMetersForQuotes(supabase, quoteIds)
      const seriesData = [0, 0, 0, 0, 0, 0]
      for (const q of quotes) {
        const date = q.production_date as string
        const idx = mondayIndexFromYmd(date)
        if (idx === null || idx > 5) continue
        const m = meters.get(q.id)?.edge ?? 0
        seriesData[idx] = round1(seriesData[idx] + m)
        dailyTotals[idx] = seriesData[idx]
      }
      if (seriesData.some((v) => v > 0)) {
        edgeByName.set('Élzárás', seriesData)
      }
    }

    // Ha még mindig 0 m, db / nap
    if (edgeByName.size === 0 && quotes.length > 0) {
      const seriesData = [0, 0, 0, 0, 0, 0]
      for (const q of quotes) {
        const date = q.production_date as string
        const idx = mondayIndexFromYmd(date)
        if (idx === null || idx > 5) continue
        seriesData[idx] += 1
        dailyTotals[idx] = seriesData[idx]
      }
      edgeByName.set('Megrendelés', seriesData)
    }
  }

  const series = [...edgeByName.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'hu'))
    .slice(0, 12)
    .map(([name, data]) => ({ name, data }))

  const resolvedUnit: 'm' | 'db' =
    series.length === 1 && series[0]?.name === 'Megrendelés' ? 'db' : 'm'

  return {
    categories: [...WEEKDAY_LABELS_HU],
    series,
    dailyTotals,
    capacityPerDayM: EDGE_CAPACITY_PER_DAY_M,
    weekStart: monday,
    weekEnd: saturday,
    weekOffset,
    orderCount: quotes.length,
    unit: resolvedUnit
  }
}

export async function getYearlyMachineAvg(
  supabase: SupabaseClient,
  tenantId: string,
  year?: number
): Promise<YearlyMachineAvgData> {
  const y = year ?? budapestYear()
  const categories = [...MONTH_LABELS_HU]

  const yearStart = `${y}-01-01`
  const yearEndExclusive = `${y + 1}-01-01`

  const { data: rows, error } = await supabase
    .from('quotes')
    .select(
      `
      id,
      production_machine_id,
      ready_at
    `
    )
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .not('ready_at', 'is', null)
    .not('production_machine_id', 'is', null)
    .gte('ready_at', `${yearStart}T00:00:00.000Z`)
    .lt('ready_at', `${yearEndExclusive}T00:00:00.000Z`)

  if (error) {
    console.error('getYearlyMachineAvg', error.message)
    throw new Error('Éves gépátlag betöltése sikertelen.')
  }

  const quotes = rows ?? []
  const meters = await sumMetersForQuotes(
    supabase,
    quotes.map((q) => q.id)
  )

  // machineId -> month -> { meters, days }
  const byMachine = new Map<
    string,
    Map<number, { meters: number; days: Set<string> }>
  >()

  for (const quote of quotes) {
    const machineId = quote.production_machine_id as string
    const readyAt = quote.ready_at as string
    const readyYmd = toBudapestYmdFromIso(readyAt)
    if (!readyYmd.startsWith(`${y}-`)) continue
    if (!isMondayToFridayYmd(readyYmd)) continue

    const monthIndex = Number(readyYmd.slice(5, 7)) - 1
    if (monthIndex < 0 || monthIndex > 11) continue

    const cutting = meters.get(quote.id)?.cutting ?? 0
    if (!byMachine.has(machineId)) byMachine.set(machineId, new Map())
    const monthMap = byMachine.get(machineId)!
    if (!monthMap.has(monthIndex)) {
      monthMap.set(monthIndex, { meters: 0, days: new Set() })
    }
    const cell = monthMap.get(monthIndex)!
    cell.meters += cutting
    cell.days.add(readyYmd)
  }

  const machineIds = [...byMachine.keys()]
  const { data: machines } = await supabase
    .from('production_machines')
    .select('id, name, usage_limit_per_day')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  const machineMeta = new Map(
    (machines ?? []).map((m) => [
      m.id,
      {
        name: m.name as string,
        limit: Number(m.usage_limit_per_day) || 0
      }
    ])
  )

  const series = (machines ?? [])
    .filter((m) => machineIds.includes(m.id) || byMachine.has(m.id))
    .map((m) => {
      const monthMap = byMachine.get(m.id)
      const data = Array.from({ length: 12 }, (_, monthIndex) => {
        const cell = monthMap?.get(monthIndex)
        if (!cell || cell.days.size === 0) return 0
        return round1(cell.meters / cell.days.size)
      })
      return {
        machineId: m.id,
        name: machineMeta.get(m.id)?.name ?? m.name,
        dailyLimitM: machineMeta.get(m.id)?.limit ?? 0,
        data
      }
    })
    .filter((s) => s.data.some((v) => v > 0))

  return { year: y, categories, series }
}

export async function getHomeOrdersTable(
  supabase: SupabaseClient,
  tenantId: string,
  limit = 25
): Promise<HomeOrderRow[]> {
  const today = budapestTodayYmd()

  const { data, error } = await supabase
    .from('quotes')
    .select(
      `
      id,
      order_number,
      status,
      production_date,
      customers ( name ),
      production_machines ( name )
    `
    )
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .not('order_number', 'is', null)
    .in('status', ['ordered', 'in_production'])

  if (error) {
    console.error('getHomeOrdersTable', error.message)
    throw new Error('Megrendeléslista betöltése sikertelen.')
  }

  const rank = { overdue: 0, today: 1, upcoming: 2, undated: 3 } as const

  const rows: HomeOrderRow[] = (data ?? []).map((row) => {
    const customers = row.customers as
      | { name: string }
      | { name: string }[]
      | null
    const customer = Array.isArray(customers) ? customers[0] : customers
    const machines = row.production_machines as
      | { name: string }
      | { name: string }[]
      | null
    const machine = Array.isArray(machines) ? machines[0] : machines
    const production_date = row.production_date as string | null
    let bucket: HomeOrderRow['bucket'] = 'undated'
    if (production_date) {
      if (production_date < today) bucket = 'overdue'
      else if (production_date === today) bucket = 'today'
      else bucket = 'upcoming'
    }
    return {
      id: row.id,
      order_number: row.order_number as string,
      status: row.status as QuoteStatus,
      customer_name: customer?.name ?? '—',
      production_machine_name: machine?.name ?? null,
      production_date,
      bucket
    }
  })

  rows.sort((a, b) => {
    const br = rank[a.bucket] - rank[b.bucket]
    if (br !== 0) return br
    return (a.production_date ?? '9999').localeCompare(
      b.production_date ?? '9999'
    )
  })

  return rows.slice(0, limit)
}

export type HomePageData = {
  backlog: BacklogMeters
  weeklyCutting: WeeklyCuttingData
  weeklyEdge: WeeklyEdgeData
  yearlyAvg: YearlyMachineAvgData
  orders: HomeOrderRow[]
  today: string
}

export async function getHomePageData(
  supabase: SupabaseClient,
  tenantId: string,
  weekOffset = 0
): Promise<HomePageData> {
  const [backlog, weeklyCutting, weeklyEdge, yearlyAvg, orders] =
    await Promise.all([
      getBacklogMeters(supabase, tenantId),
      getWeeklyCutting(supabase, tenantId, weekOffset),
      getWeeklyEdge(supabase, tenantId, weekOffset),
      getYearlyMachineAvg(supabase, tenantId),
      getHomeOrdersTable(supabase, tenantId)
    ])

  return {
    backlog,
    weeklyCutting,
    weeklyEdge,
    yearlyAvg,
    orders,
    today: budapestTodayYmd()
  }
}