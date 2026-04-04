import { NextRequest, NextResponse } from 'next/server'

import { supabaseServer } from '@/lib/supabase-server'

export interface ProductionMachineRow {
  machine_id: string | null
  machine_name: string
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

function parseYearMonth(
  request: NextRequest
): { ok: true; year: number; month: number } | { ok: false; message: string } {
  const y = request.nextUrl.searchParams.get('year')
  const m = request.nextUrl.searchParams.get('month')
  if (y !== null || m !== null) {
    if (y === null || m === null) {
      return { ok: false, message: 'A year és month paramétereket együtt kell megadni.' }
    }
    const year = Number.parseInt(y, 10)
    const month = Number.parseInt(m, 10)
    if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
      return { ok: false, message: 'Érvénytelen year vagy month paraméter.' }
    }
    return { ok: true, year, month }
  }
  const now = new Date()
  return { ok: true, year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 }
}

function isMissingRpcError(message: string | undefined): boolean {
  if (!message) return false
  const low = message.toLowerCase()
  return (
    low.includes('function public.get_reports_production_by_machine') ||
    low.includes('get_reports_production_by_machine') ||
    low.includes('does not exist') ||
    low.includes('schema cache')
  )
}

export async function GET(request: NextRequest) {
  const ym = parseYearMonth(request)
  if (!ym.ok) {
    return NextResponse.json({ error: ym.message }, { status: 400 })
  }

  const { data, error } = await supabaseServer.rpc('get_reports_production_by_machine', {
    p_year: ym.year,
    p_month: ym.month
  })

  if (error) {
    console.error('get_reports_production_by_machine RPC error:', error)
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
    machine_id: string | null
    machine_name: string
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

  const normalized: ProductionMachineRow[] = rows.map(r => ({
    machine_id: r.machine_id,
    machine_name: r.machine_name,
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

  return NextResponse.json({
    year: ym.year,
    month: ym.month,
    data: normalized
  })
}
