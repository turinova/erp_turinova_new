import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/orders/item-availability-preview?product_ids=id1,id2
 * Same availability payload as order item-availability, without an existing order (for /orders/new).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const extraIds = url.searchParams.get('product_ids')
    const productIds = new Set<string>()
    const skuToId = new Map<string, string>()

    if (extraIds) {
      extraIds.split(',').map((id) => id.trim()).filter(Boolean).forEach((id) => productIds.add(id))
    }

    if (productIds.size === 0) {
      return NextResponse.json({ availability: {}, sku_to_product_id: {} })
    }

    try {
      await supabase.rpc('refresh_stock_summary').catch(() => {})
    } catch {
      // ignore
    }

    const ids = [...productIds]
    const result: Record<string, {
      quantity_available: number
      quantity_on_hand: number
      quantity_reserved: number
      quantity_incoming: number
    }> = {}

    const { data: stockRows, error: stockErr } = await supabase
      .from('stock_summary')
      .select('product_id, quantity_on_hand, quantity_available, quantity_reserved')
      .in('product_id', ids)

    if (!stockErr && stockRows) {
      for (const pid of ids) {
        const rows = (stockRows as any[]).filter((r: any) => r.product_id === pid)
        const quantity_on_hand = rows.reduce((s: number, r: any) => s + (parseFloat(String(r.quantity_on_hand)) || 0), 0)
        const quantity_available = rows.reduce((s: number, r: any) => s + (parseFloat(String(r.quantity_available)) || 0), 0)
        const quantity_reserved = rows.reduce((s: number, r: any) => s + (parseFloat(String(r.quantity_reserved)) || 0), 0)
        result[pid] = {
          quantity_on_hand: Math.round(quantity_on_hand * 100) / 100,
          quantity_available: Math.round(quantity_available * 100) / 100,
          quantity_reserved: Math.round(quantity_reserved * 100) / 100,
          quantity_incoming: 0
        }
      }
    }

    for (const pid of ids) {
      if (!result[pid]) {
        result[pid] = { quantity_on_hand: 0, quantity_available: 0, quantity_reserved: 0, quantity_incoming: 0 }
      }
    }

    const OPEN_PO_STATUSES = ['draft', 'pending_approval', 'approved', 'partially_received']
    const { data: openPOs } = await supabase
      .from('purchase_orders')
      .select('id')
      .in('status', OPEN_PO_STATUSES)
      .is('deleted_at', null)
    const openPoIds = new Set((openPOs || []).map((p: any) => p.id))
    if (openPoIds.size > 0) {
      const { data: poItems, error: poErr } = await supabase
        .from('purchase_order_items')
        .select('product_id, quantity, received_quantity, purchase_order_id')
        .in('product_id', ids)
        .in('purchase_order_id', [...openPoIds])
        .is('deleted_at', null)
      if (!poErr && poItems) {
        for (const row of poItems as any[]) {
          const pid = row.product_id
          if (!pid) continue
          const qty = parseFloat(String(row.quantity)) || 0
          const received = parseFloat(String(row.received_quantity)) || 0
          const pending = Math.max(0, qty - received)
          if (pending <= 0) continue
          if (!result[pid]) result[pid] = { quantity_on_hand: 0, quantity_available: 0, quantity_reserved: 0, quantity_incoming: 0 }
          result[pid].quantity_incoming = (result[pid].quantity_incoming || 0) + pending
        }
      }
    }

    for (const pid of Object.keys(result)) {
      result[pid].quantity_incoming = Math.round((result[pid].quantity_incoming || 0) * 100) / 100
    }

    return NextResponse.json({ availability: result, sku_to_product_id: Object.fromEntries(skuToId) })
  } catch (error) {
    console.error('Error in item-availability-preview API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
