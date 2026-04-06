import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

function num(v: unknown): number {
  if (typeof v === 'number') return v
  const n = Number(v)
  return Number.isNaN(n) ? 0 : n
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [summaryRes, monthlyRes, breakdownRes, materialsRes, ordersRes] = await Promise.all([
    supabaseServer.rpc('get_customer_summary', { p_customer_id: id }),
    supabaseServer.rpc('get_customer_monthly_revenue', { p_customer_id: id }),
    supabaseServer.rpc('get_customer_revenue_breakdown', { p_customer_id: id }),
    supabaseServer.rpc('get_customer_top_materials', { p_customer_id: id, p_limit: 5 }),
    supabaseServer.rpc('get_customer_recent_orders', { p_customer_id: id, p_limit: 50 })
  ])

  for (const r of [summaryRes, monthlyRes, breakdownRes, materialsRes, ordersRes]) {
    if (r.error) {
      console.error('Customer stats RPC error:', r.error)
      return NextResponse.json({ error: r.error.message }, { status: 500 })
    }
  }

  const raw = Array.isArray(summaryRes.data) ? summaryRes.data[0] : summaryRes.data
  const summary = raw
    ? {
        total_quotes: num(raw.total_quotes),
        total_orders: num(raw.total_orders),
        total_revenue: num(raw.total_revenue),
        avg_order_value: num(raw.avg_order_value),
        first_order_date: raw.first_order_date ?? null,
        last_order_date: raw.last_order_date ?? null,
        days_since_last: num(raw.days_since_last),
        draft_value: num(raw.draft_value),
        status_draft: num(raw.status_draft),
        status_accepted: num(raw.status_accepted),
        status_ordered: num(raw.status_ordered),
        status_in_production: num(raw.status_in_production),
        status_ready: num(raw.status_ready),
        status_done: num(raw.status_done),
        status_finished: num(raw.status_finished),
        cancelled_count: num(raw.cancelled_count)
      }
    : null

  const monthly = ((monthlyRes.data || []) as Record<string, unknown>[]).map(r => ({
    month: String(r.month ?? ''),
    revenue: num(r.revenue),
    order_count: num(r.order_count)
  }))

  const bRaw = Array.isArray(breakdownRes.data) ? breakdownRes.data[0] : breakdownRes.data
  const breakdown = bRaw
    ? {
        material_gross: num(bRaw.material_gross),
        cutting_gross: num(bRaw.cutting_gross),
        edge_materials_gross: num(bRaw.edge_materials_gross),
        services_gross: num(bRaw.services_gross),
        fees_gross: num(bRaw.fees_gross),
        accessories_gross: num(bRaw.accessories_gross),
        cutting_length_m: num(bRaw.cutting_length_m),
        tabla_m2: num(bRaw.tabla_m2),
        edge_length_m: num(bRaw.edge_length_m)
      }
    : null

  const topMaterials = ((materialsRes.data || []) as Record<string, unknown>[]).map(r => ({
    material_id: String(r.material_id ?? ''),
    material_name: String(r.material_name ?? ''),
    thickness_mm: num(r.thickness_mm),
    material_gross: num(r.material_gross),
    tabla_m2: num(r.tabla_m2),
    quote_count: num(r.quote_count)
  }))

  const recentOrders = ((ordersRes.data || []) as Record<string, unknown>[]).map(r => ({
    quote_id: String(r.quote_id ?? ''),
    quote_number: String(r.quote_number ?? ''),
    order_number: r.order_number ? String(r.order_number) : null,
    production_date: r.production_date ? String(r.production_date) : null,
    created_at: r.created_at ? String(r.created_at) : null,
    status: String(r.status ?? ''),
    total_gross: num(r.total_gross),
    payment_status: String(r.payment_status ?? '')
  }))

  return NextResponse.json({ summary, monthly, breakdown, topMaterials, recentOrders })
}
