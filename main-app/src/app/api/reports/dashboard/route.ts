import { NextRequest, NextResponse } from 'next/server'

import { supabaseServer } from '@/lib/supabase-server'

type Granularity = 'day' | 'week' | 'month'

interface SeriesRow {
  period: string
  quote_count: number
  cutting_length_m: number
  tabla_m2: number
  edge_length_m: number
  material_gross: number
  cutting_gross: number
  edge_materials_gross: number
  services_gross: number
  lines_gross_total: number
  estimated_material_cost: number
  estimated_material_profit: number
  production_days: number
}

interface TopCustomerRow {
  customer_id: string
  customer_name: string
  quote_count: number
  total_gross: number
}

interface TopMaterialRow {
  material_id: string
  material_name: string
  thickness_mm: number
  material_gross: number
  tabla_m2: number
  quote_count: number
  estimated_cost: number
  estimated_profit: number
  on_stock: boolean
}

function parseDate(raw: string | null): string | null {
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return null
}

function currentMonthRange(): { start: string; end: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const start = new Date(y, m, 1)
  const end = new Date(y, m + 1, 0)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { start: fmt(start), end: fmt(end) }
}

function previousMonthRange(): { start: string; end: string } {
  const now = new Date()
  const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1
  const start = new Date(y, m, 1)
  const end = new Date(y, m + 1, 0)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { start: fmt(start), end: fmt(end) }
}

function normalizeNumericRow(r: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(r)) {
    if (typeof val === 'string' && key !== 'period' && key !== 'customer_name' && key !== 'material_name' && key !== 'customer_id' && key !== 'material_id') {
      const n = Number(val)
      result[key] = Number.isNaN(n) ? val : n
    } else {
      result[key] = val
    }
  }
  return result
}

function isMissingRpcError(msg: string | undefined): boolean {
  if (!msg) return false
  const low = msg.toLowerCase()
  return low.includes('does not exist') || low.includes('schema cache')
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const startRaw = parseDate(sp.get('start'))
  const endRaw = parseDate(sp.get('end'))
  const granularity: Granularity =
    sp.get('granularity') === 'day' ? 'day' : sp.get('granularity') === 'week' ? 'week' : 'month'

  if (!startRaw || !endRaw) {
    return NextResponse.json({ error: 'A start és end dátum kötelező (YYYY-MM-DD).' }, { status: 400 })
  }

  const curMonth = currentMonthRange()
  const prevMonth = previousMonthRange()

  const [seriesResult, kpiResult, prevKpiResult, customersResult, materialsResult] = await Promise.all([
    supabaseServer.rpc('get_reports_dashboard_series', {
      p_start: startRaw,
      p_end: endRaw,
      p_granularity: granularity
    }),
    supabaseServer.rpc('get_reports_dashboard_series', {
      p_start: curMonth.start,
      p_end: curMonth.end,
      p_granularity: 'month'
    }),
    supabaseServer.rpc('get_reports_dashboard_series', {
      p_start: prevMonth.start,
      p_end: prevMonth.end,
      p_granularity: 'month'
    }),
    supabaseServer.rpc('get_reports_top_customers', {
      p_start: startRaw,
      p_end: endRaw,
      p_limit: 20
    }),
    supabaseServer.rpc('get_reports_top_materials', {
      p_start: startRaw,
      p_end: endRaw,
      p_limit: 20
    })
  ])

  for (const r of [seriesResult, kpiResult, prevKpiResult, customersResult, materialsResult]) {
    if (r.error) {
      console.error('Dashboard RPC error:', r.error)
      const msg = r.error.message || 'RPC failed'
      if (isMissingRpcError(msg)) {
        return NextResponse.json(
          { error: 'A riport adatbázis-függvények még nincsenek telepítve. Futtassa: supabase/migrations/20260404_reports_dashboard_v2.sql' },
          { status: 503 }
        )
      }
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  const normalizeSeries = (rows: Record<string, unknown>[]): SeriesRow[] =>
    (rows || []).map(r => {
      const n = normalizeNumericRow(r)
      return {
        period: String(n.period ?? ''),
        quote_count: Number(n.quote_count ?? 0),
        cutting_length_m: Number(n.cutting_length_m ?? 0),
        tabla_m2: Number(n.tabla_m2 ?? 0),
        edge_length_m: Number(n.edge_length_m ?? 0),
        material_gross: Number(n.material_gross ?? 0),
        cutting_gross: Number(n.cutting_gross ?? 0),
        edge_materials_gross: Number(n.edge_materials_gross ?? 0),
        services_gross: Number(n.services_gross ?? 0),
        lines_gross_total: Number(n.lines_gross_total ?? 0),
        estimated_material_cost: Number(n.estimated_material_cost ?? 0),
        estimated_material_profit: Number(n.estimated_material_profit ?? 0),
        production_days: Number(n.production_days ?? 0)
      }
    })

  const series = normalizeSeries(seriesResult.data as Record<string, unknown>[])
  const kpiRows = normalizeSeries(kpiResult.data as Record<string, unknown>[])
  const prevKpiRows = normalizeSeries(prevKpiResult.data as Record<string, unknown>[])

  const kpi = kpiRows[0] ?? null
  const prevKpi = prevKpiRows[0] ?? null

  const topCustomers: TopCustomerRow[] = ((customersResult.data || []) as Record<string, unknown>[]).map(r => ({
    customer_id: String(r.customer_id ?? ''),
    customer_name: String(r.customer_name ?? ''),
    quote_count: Number(r.quote_count ?? 0),
    total_gross: Number(r.total_gross ?? 0)
  }))

  const topMaterials: TopMaterialRow[] = ((materialsResult.data || []) as Record<string, unknown>[]).map(r => ({
    material_id: String(r.material_id ?? ''),
    material_name: String(r.material_name ?? ''),
    thickness_mm: Number(r.thickness_mm ?? 0),
    material_gross: Number(r.material_gross ?? 0),
    tabla_m2: Number(r.tabla_m2 ?? 0),
    quote_count: Number(r.quote_count ?? 0),
    estimated_cost: Number(r.estimated_cost ?? 0),
    estimated_profit: Number(r.estimated_profit ?? 0),
    on_stock: r.on_stock === true
  }))

  return NextResponse.json({
    series,
    kpi,
    prevKpi,
    topCustomers,
    topMaterials,
    filters: { start: startRaw, end: endRaw, granularity }
  })
}
