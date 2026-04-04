import { NextRequest, NextResponse } from 'next/server'

import { supabaseServer } from '@/lib/supabase-server'

export interface ReadyEconomicsMonthlyRow {
  month: string
  quote_count: number
  quote_revenue_gross: number
  material_gross_sum: number
  cutting_gross_sum: number
  edge_materials_gross_sum: number
  services_gross_sum: number
  lines_gross_sum: number
  cutting_length_m: number
  charged_board_m2: number
  material_contribution_net_sum: number
  full_board_pricing_lines: number
  total_pricing_lines: number
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
    m.includes('get_reports_ready_monthly_economics') ||
    m.includes('does not exist') ||
    m.includes('schema cache')
  )
}

export async function GET(request: NextRequest) {
  const months = clampMonths(request.nextUrl.searchParams.get('months'))

  const { data, error } = await supabaseServer.rpc('get_reports_ready_monthly_economics', {
    p_months: months
  })

  if (error) {
    console.error('get_reports_ready_monthly_economics RPC error:', error)
    const msg = error.message || 'RPC failed'
    if (isMissingRpcError(msg)) {
      return NextResponse.json(
        {
          error:
            'A lezárt havi economics RPC még nincs telepítve. Futtassa: supabase/migrations/20260403_reports_ready_monthly_economics.sql'
        },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const rows = (data || []) as Array<Record<string, unknown>>

  const normalized: ReadyEconomicsMonthlyRow[] = rows.map(r => ({
    month: typeof r.month === 'string' ? r.month : String(r.month),
    quote_count: Number(r.quote_count),
    quote_revenue_gross: Number(r.quote_revenue_gross),
    material_gross_sum: Number(r.material_gross_sum),
    cutting_gross_sum: Number(r.cutting_gross_sum),
    edge_materials_gross_sum: Number(r.edge_materials_gross_sum),
    services_gross_sum: Number(r.services_gross_sum),
    lines_gross_sum: Number(r.lines_gross_sum),
    cutting_length_m: Number(r.cutting_length_m),
    charged_board_m2: Number(r.charged_board_m2),
    material_contribution_net_sum: Number(r.material_contribution_net_sum),
    full_board_pricing_lines: Number(r.full_board_pricing_lines),
    total_pricing_lines: Number(r.total_pricing_lines)
  }))

  return NextResponse.json({ months, data: normalized })
}
