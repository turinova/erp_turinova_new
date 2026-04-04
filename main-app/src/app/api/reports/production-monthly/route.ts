import { NextRequest, NextResponse } from 'next/server'

import { supabaseServer } from '@/lib/supabase-server'

export interface ProductionMonthlyRow {
  month: string
  quote_count: number
  quote_revenue_gross: number
  cutting_length_m: number
  tabla_m2_plus_charged_sqm: number
  material_gross_sum: number
  edge_materials_gross_sum: number
  cutting_gross_sum: number
  services_gross_sum: number
  lines_gross_sum: number
}

function clampMonths(raw: string | null): number {
  const n = raw ? Number.parseInt(raw, 10) : 24
  if (Number.isNaN(n)) return 24
  return Math.min(60, Math.max(1, n))
}

function isMissingRpcError(message: string | undefined): boolean {
  if (!message) return false
  const m = message.toLowerCase()
  return (
    m.includes('function public.get_reports_production_monthly') ||
    m.includes('get_reports_production_monthly') ||
    m.includes('does not exist') ||
    m.includes('schema cache')
  )
}

export async function GET(request: NextRequest) {
  const months = clampMonths(request.nextUrl.searchParams.get('months'))

  const { data, error } = await supabaseServer.rpc('get_reports_production_monthly', {
    p_months: months
  })

  if (error) {
    console.error('get_reports_production_monthly RPC error:', error)
    const msg = error.message || 'RPC failed'
    if (isMissingRpcError(msg)) {
      return NextResponse.json(
        {
          error:
            'A gyártási riport adatbázis-függvénye még nincs telepítve. Futtassa a supabase/migrations/20260402_reports_production_kpis.sql migrációt.'
        },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const rows = (data || []) as Array<{
    month: string
    quote_count: number | string
    quote_revenue_gross: number | string
    cutting_length_m: number | string
    tabla_m2_plus_charged_sqm: number | string
    material_gross_sum: number | string
    edge_materials_gross_sum: number | string
    cutting_gross_sum: number | string
    services_gross_sum: number | string
    lines_gross_sum: number | string
  }>

  const normalized: ProductionMonthlyRow[] = rows.map(r => ({
    month: typeof r.month === 'string' ? r.month : String(r.month),
    quote_count: Number(r.quote_count),
    quote_revenue_gross: Number(r.quote_revenue_gross),
    cutting_length_m: Number(r.cutting_length_m),
    tabla_m2_plus_charged_sqm: Number(r.tabla_m2_plus_charged_sqm),
    material_gross_sum: Number(r.material_gross_sum),
    edge_materials_gross_sum: Number(r.edge_materials_gross_sum),
    cutting_gross_sum: Number(r.cutting_gross_sum),
    services_gross_sum: Number(r.services_gross_sum),
    lines_gross_sum: Number(r.lines_gross_sum)
  }))

  return NextResponse.json({ months, data: normalized })
}
