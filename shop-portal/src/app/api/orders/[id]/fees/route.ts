import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { recomputeOrderAfterFeesChange } from '@/lib/order-fees-recompute'

function roundCurrency(value: number, currencyCode: string): number {
  return (currencyCode || 'HUF').toUpperCase() === 'HUF'
    ? Math.round(value)
    : Math.round(value * 100) / 100
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('order_fees')
      .select('id, fee_definition_id, source, type, name, quantity, unit_net, unit_gross, vat_rate, line_net, line_gross, currency_code, sort_order, is_locked, created_at, updated_at')
      .eq('order_id', orderId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ fees: data || [] })
  } catch (e) {
    console.error('GET /api/orders/[id]/fees', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const feeDefinitionId = String(body.fee_definition_id || '').trim()
    if (!feeDefinitionId) return NextResponse.json({ error: 'fee_definition_id kötelező' }, { status: 400 })

    const { data: order } = await supabase
      .from('orders')
      .select('id, currency_code')
      .eq('id', orderId)
      .single()
    if (!order) return NextResponse.json({ error: 'Rendelés nem található' }, { status: 404 })

    const { data: def } = await supabase
      .from('fee_definitions')
      .select('*')
      .eq('id', feeDefinitionId)
      .is('deleted_at', null)
      .eq('is_active', true)
      .single()
    if (!def) return NextResponse.json({ error: 'Díj definíció nem található' }, { status: 404 })

    const qty = Math.max(0.001, Number(body.quantity ?? 1) || 1)
    const gross = body.unit_gross != null ? Number(body.unit_gross) : Number(def.default_gross ?? 0)
    const vatRate = Number(body.vat_rate ?? def.default_vat_rate ?? 27) || 27
    const unitGross = roundCurrency(gross, order.currency_code || 'HUF')
    const unitNet = vatRate > 0 ? roundCurrency(unitGross / (1 + vatRate / 100), order.currency_code || 'HUF') : unitGross
    const lineGross = roundCurrency(unitGross * qty, order.currency_code || 'HUF')
    const lineNet = roundCurrency(unitNet * qty, order.currency_code || 'HUF')

    const { data, error } = await supabase
      .from('order_fees')
      .insert({
        order_id: orderId,
        fee_definition_id: def.id,
        source: 'manual',
        type: def.type,
        name: def.name,
        quantity: qty,
        unit_net: unitNet,
        unit_gross: unitGross,
        vat_rate: vatRate,
        line_net: lineNet,
        line_gross: lineGross,
        currency_code: order.currency_code || 'HUF',
        sort_order: Number(def.sort_order ?? 100) || 100
      })
      .select('id, fee_definition_id, source, type, name, quantity, unit_net, unit_gross, vat_rate, line_net, line_gross, currency_code, sort_order, is_locked, created_at, updated_at')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await recomputeOrderAfterFeesChange(supabase, orderId)
    return NextResponse.json({ fee: data }, { status: 201 })
  } catch (e) {
    console.error('POST /api/orders/[id]/fees', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

