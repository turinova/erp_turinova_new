import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

type WorkshopMachine = {
  id: string
  name: string
  machine_type: 'edge_bander' | 'panel_saw' | string
}

type DayPoint = {
  date: string
  abs: number | null
  deltaM: number | null
  missing: boolean
}

function isIsoDate(s: string) {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s)
}

function parseIsoDateToUtcMidnight(yyyyMmDd: string) {
  const y = Number(yyyyMmDd.slice(0, 4))
  const m = Number(yyyyMmDd.slice(5, 7))
  const d = Number(yyyyMmDd.slice(8, 10))
  return new Date(Date.UTC(y, m - 1, d))
}

function addDaysIso(yyyyMmDd: string, days: number) {
  const dt = parseIsoDateToUtcMidnight(yyyyMmDd)
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

function eachDateInclusive(start: string, end: string) {
  const out: string[] = []
  let cur = start
  // Guard against pathological input
  let guard = 0
  while (cur <= end && guard < 400) {
    out.push(cur)
    cur = addDaysIso(cur, 1)
    guard += 1
  }
  return out
}

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
      }
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabase()
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const start = request.nextUrl.searchParams.get('start')?.trim() || ''
    const end = request.nextUrl.searchParams.get('end')?.trim() || ''
    if (!isIsoDate(start) || !isIsoDate(end)) {
      return NextResponse.json({ error: 'start/end must be YYYY-MM-DD' }, { status: 400 })
    }
    if (start > end) {
      return NextResponse.json({ error: 'start must be <= end' }, { status: 400 })
    }

    const { data: machines, error: mErr } = await supabase
      .from('workshop_machines')
      .select('id, name, machine_type')
      .eq('is_active', true)
      .order('machine_type', { ascending: true })
      .order('name', { ascending: true })

    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

    const machineList = (machines ?? []) as WorkshopMachine[]
    if (machineList.length === 0) {
      return NextResponse.json({ start, end, machines: [], series: {} })
    }

    const { data: readings, error: rErr } = await supabase
      .from('production_machine_daily_readings')
      .select('machine_id, reading_date, reading_value')
      .gte('reading_date', start)
      .lte('reading_date', end)
      .in(
        'machine_id',
        machineList.map(m => m.id)
      )
      .order('reading_date', { ascending: true })

    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })

    // Also fetch a single "baseline" value immediately before the range, per machine, for first-day delta.
    const baselines = new Map<string, number | null>()
    for (const m of machineList) {
      const { data: prev, error: pErr } = await supabase
        .from('production_machine_daily_readings')
        .select('reading_value, reading_date')
        .eq('machine_id', m.id)
        .lt('reading_date', start)
        .order('reading_date', { ascending: false })
        .limit(1)

      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
      const v = prev && prev[0] ? Number((prev[0] as { reading_value: number | string | null }).reading_value) : null
      baselines.set(m.id, v === null || Number.isNaN(v) ? null : v)
    }

    // Index readings: machine -> date -> abs
    const absByMachineDate = new Map<string, Map<string, number>>()
    for (const m of machineList) absByMachineDate.set(m.id, new Map())
    for (const r of (readings ?? []) as Array<{ machine_id: string; reading_date: string; reading_value: number | string }>) {
      const mid = r.machine_id
      const day = r.reading_date
      const val = Number(r.reading_value)
      if (!absByMachineDate.has(mid)) continue
      absByMachineDate.get(mid)!.set(day, val)
    }

    const days = eachDateInclusive(start, end)
    const series: Record<string, { machine: WorkshopMachine; points: DayPoint[] }> = {}

    for (const m of machineList) {
      const byDay = absByMachineDate.get(m.id) ?? new Map()
      const points: DayPoint[] = []
      let prevAbs = baselines.get(m.id) ?? null

      for (const d of days) {
        const abs = byDay.has(d) ? (byDay.get(d) as number) : null
        if (abs === null) {
          points.push({ date: d, abs: null, deltaM: null, missing: true })
          continue
        }
        // abs exists for this day
        let delta: number | null = null
        if (prevAbs === null) {
          delta = null
        } else {
          delta = abs - prevAbs
        }
        points.push({ date: d, abs, deltaM: delta, missing: false })
        prevAbs = abs
      }

      series[m.id] = { machine: m, points }
    }

    // Compute totals by summing non-null machine daily deltas
    const totalsByType: Record<string, number> = {
      edge_bander: 0,
      panel_saw: 0
    }
    for (const m of machineList) {
      const pts = series[m.id].points
      let sum = 0
      for (const p of pts) {
        if (p.deltaM !== null && !p.missing) sum += p.deltaM
      }
      if (m.machine_type === 'edge_bander') totalsByType.edge_bander += sum
      if (m.machine_type === 'panel_saw') totalsByType.panel_saw += sum
    }

    return NextResponse.json({
      start,
      end,
      machines: machineList,
      series,
      totalsByType: {
        edge_bander: Math.round(totalsByType.edge_bander * 1000) / 1000,
        panel_saw: Math.round(totalsByType.panel_saw * 1000) / 1000
      }
    })
  } catch (e) {
    console.error('workshop-meters report GET:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
