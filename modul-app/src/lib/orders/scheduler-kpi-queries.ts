import type { SupabaseClient } from '@supabase/supabase-js'

import {
  BACKLOG_MAX_AGE_DAYS,
  addDaysYmd,
  budapestTodayYmd,
  budapestYesterdayYmd
} from '@/lib/home/date'

const OPEN_STATUSES = ['ordered', 'in_production'] as const

export type SchedulerMachineLoad = {
  id: string
  name: string
  cuttingM: number
  limitM: number
  /** cutting / limit · 100; limit 0 → 0 */
  pct: number
}

export type SchedulerKpis = {
  today: {
    cuttingM: number
    limitM: number
    pct: number
    orderCount: number
    byMachine: SchedulerMachineLoad[]
  }
  overdue: {
    count: number
    cuttingM: number
  }
  unscheduled: {
    count: number
    cuttingM: number
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

async function sumCuttingByQuote(
  supabase: SupabaseClient,
  quoteIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (quoteIds.length === 0) return map

  const { data, error } = await supabase
    .from('quote_material_lines')
    .select('quote_id, cutting_length_m')
    .in('quote_id', quoteIds)

  if (error) {
    console.error('getSchedulerKpis meters', error.message)
    return map
  }

  for (const row of data ?? []) {
    const id = row.quote_id as string
    map.set(id, (map.get(id) ?? 0) + (Number(row.cutting_length_m) || 0))
  }
  return map
}

/**
 * Gyártásszervező glance a /megrendelesek tetején.
 * Open = ordered|in_production; archív / soft-delete / cancelled ki.
 */
export async function getSchedulerKpis(
  supabase: SupabaseClient,
  tenantId: string
): Promise<SchedulerKpis> {
  const today = budapestTodayYmd()
  const yesterday = budapestYesterdayYmd()
  const windowStart = addDaysYmd(today, -BACKLOG_MAX_AGE_DAYS)

  const empty: SchedulerKpis = {
    today: { cuttingM: 0, limitM: 0, pct: 0, orderCount: 0, byMachine: [] },
    overdue: { count: 0, cuttingM: 0 },
    unscheduled: { count: 0, cuttingM: 0 }
  }

  const [machinesRes, quotesRes] = await Promise.all([
    supabase
      .from('production_machines')
      .select('id, name, usage_limit_per_day')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    supabase
      .from('quotes')
      .select('id, production_date, production_machine_id')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .is('archived_at', null)
      .not('order_number', 'is', null)
      .in('status', [...OPEN_STATUSES])
  ])

  if (machinesRes.error) {
    console.error('getSchedulerKpis machines', machinesRes.error.message)
  }
  if (quotesRes.error) {
    console.error('getSchedulerKpis quotes', quotesRes.error.message)
    return empty
  }

  const machines = (machinesRes.data ?? []).map((m) => ({
    id: m.id as string,
    name: m.name as string,
    limitM: Number(m.usage_limit_per_day) || 0
  }))

  const quotes = (quotesRes.data ?? []) as {
    id: string
    production_date: string | null
    production_machine_id: string | null
  }[]

  const todayRows: typeof quotes = []
  const overdueRows: typeof quotes = []
  const unscheduledRows: typeof quotes = []

  for (const q of quotes) {
    const ymd = q.production_date?.slice(0, 10) ?? null
    if (!ymd) {
      unscheduledRows.push(q)
      continue
    }
    if (ymd === today) {
      todayRows.push(q)
      continue
    }
    if (ymd <= yesterday && ymd >= windowStart) {
      overdueRows.push(q)
    }
  }

  const meterIds = [
    ...new Set([
      ...todayRows.map((r) => r.id),
      ...overdueRows.map((r) => r.id),
      ...unscheduledRows.map((r) => r.id)
    ])
  ]
  const cuttingByQuote = await sumCuttingByQuote(supabase, meterIds)

  const sumCutting = (rows: typeof quotes) =>
    round1(rows.reduce((s, r) => s + (cuttingByQuote.get(r.id) ?? 0), 0))

  const limitM = machines.reduce((s, m) => s + m.limitM, 0)
  const todayCutting = sumCutting(todayRows)
  const todayPct =
    limitM > 0 ? Math.round((todayCutting / limitM) * 1000) / 10 : 0

  const byMachineMap = new Map<string, number>()
  for (const r of todayRows) {
    if (!r.production_machine_id) continue
    byMachineMap.set(
      r.production_machine_id,
      (byMachineMap.get(r.production_machine_id) ?? 0) +
        (cuttingByQuote.get(r.id) ?? 0)
    )
  }

  const byMachine: SchedulerMachineLoad[] = machines.map((m) => {
    const cuttingM = round1(byMachineMap.get(m.id) ?? 0)
    const pct =
      m.limitM > 0 ? Math.round((cuttingM / m.limitM) * 1000) / 10 : 0
    return {
      id: m.id,
      name: m.name,
      cuttingM,
      limitM: m.limitM,
      pct
    }
  })

  // Gépek null terheléssel is — de ha nincs gép, üres.
  // Rendezés: terhelés desc, hogy a full legyen felül.
  byMachine.sort((a, b) => b.cuttingM - a.cuttingM || a.name.localeCompare(b.name, 'hu'))

  return {
    today: {
      cuttingM: todayCutting,
      limitM: round1(limitM),
      pct: todayPct,
      orderCount: todayRows.length,
      byMachine
    },
    overdue: {
      count: overdueRows.length,
      cuttingM: sumCutting(overdueRows)
    },
    unscheduled: {
      count: unscheduledRows.length,
      cuttingM: sumCutting(unscheduledRows)
    }
  }
}
