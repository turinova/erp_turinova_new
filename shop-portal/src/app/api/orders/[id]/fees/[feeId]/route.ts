import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { recomputeOrderAfterFeesChange } from '@/lib/order-fees-recompute'

function roundCurrency(value: number, currencyCode: string): number {
  return (currencyCode || 'HUF').toUpperCase() === 'HUF'
    ? Math.round(value)
    : Math.round(value * 100) / 100
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; feeId: string }> }
) {
  try {
    const { id: orderId, feeId } = await params
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { data: fee } = await supabase
      .from('order_fees')
      .select('id, order_id, currency_code, quantity, vat_rate, is_locked')
      .eq('id', feeId)
      .eq('order_id', orderId)
      .is('deleted_at', null)
      .single()
    if (!fee) return NextResponse.json({ error: 'Díj sor nem található' }, { status: 404 })
    if (fee.is_locked) return NextResponse.json({ error: 'Ez a díj sor zárolt, nem módosítható' }, { status: 409 })

    const qty = Math.max(0.001, Number(body.quantity ?? fee.quantity) || Number(fee.quantity))
    const vatRate = Number(body.vat_rate ?? fee.vat_rate) || Number(fee.vat_rate) || 27
    const unitGross = roundCurrency(Number(body.unit_gross ?? 0), fee.currency_code || 'HUF')
    const unitNet = vatRate > 0 ? roundCurrency(unitGross / (1 + vatRate / 100), fee.currency_code || 'HUF') : unitGross
    const lineGross = roundCurrency(unitGross * qty, fee.currency_code || 'HUF')
    const lineNet = roundCurrency(unitNet * qty, fee.currency_code || 'HUF')

    const { data, error } = await supabase
      .from('order_fees')
      .update({
        quantity: qty,
        vat_rate: vatRate,
        unit_gross: unitGross,
        unit_net: unitNet,
        line_gross: lineGross,
        line_net: lineNet,
        updated_at: new Date().toISOString()
      })
      .eq('id', feeId)
      .eq('order_id', orderId)
      .select('id, fee_definition_id, source, type, name, quantity, unit_net, unit_gross, vat_rate, line_net, line_gross, currency_code, sort_order, is_locked, created_at, updated_at')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await recomputeOrderAfterFeesChange(supabase, orderId)
    return NextResponse.json({ fee: data })
  } catch (e) {
    console.error('PATCH /api/orders/[id]/fees/[feeId]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; feeId: string }> }
) {
  try {
    const { id: orderId, feeId } = await params
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: fee } = await supabase
      .from('order_fees')
      .select('id, is_locked')
      .eq('id', feeId)
      .eq('order_id', orderId)
      .is('deleted_at', null)
      .single()
    if (!fee) return NextResponse.json({ error: 'Díj sor nem található' }, { status: 404 })
    if (fee.is_locked) return NextResponse.json({ error: 'Ez a díj sor zárolt, nem törölhető' }, { status: 409 })

    const { error } = await supabase
      .from('order_fees')
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', feeId)
      .eq('order_id', orderId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await recomputeOrderAfterFeesChange(supabase, orderId)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE /api/orders/[id]/fees/[feeId]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

