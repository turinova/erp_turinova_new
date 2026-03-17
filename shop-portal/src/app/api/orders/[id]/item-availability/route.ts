import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

export interface ItemAvailabilityRow {
  quantity_available: number
  quantity_on_hand: number
  quantity_reserved: number
  quantity_incoming: number
}

/**
 * GET /api/orders/[id]/item-availability
 * Returns per product_id: quantity_available, quantity_on_hand, quantity_incoming
 * for all products that appear in this order's items.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id')
      .eq('id', orderId)
      .is('deleted_at', null)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('product_id, product_sku')
      .eq('order_id', orderId)
      .is('deleted_at', null)

    if (itemsError) {
      return NextResponse.json({ error: 'Failed to load order items' }, { status: 500 })
    }

    const productIds = new Set<string>()
    const url = new URL(request.url)
    const extraIds = url.searchParams.get('product_ids')
    if (extraIds) {
      extraIds.split(',').map((id) => id.trim()).filter(Boolean).forEach((id) => productIds.add(id))
    }
    const skuToId = new Map<string, string>()
    for (const row of orderItems || []) {
      const pid = row.product_id ? String(row.product_id) : null
      const sku = row.product_sku ? String(row.product_sku).trim() : null
      if (pid) productIds.add(pid)
      if (sku && !pid) {
        if (!skuToId.has(sku)) skuToId.set(sku, '')
      }
    }

    if (skuToId.size > 0) {
      const skus = [...skuToId.keys()]
      for (const sku of skus) {
        const { data: product } = await supabase
          .from('shoprenter_products')
          .select('id')
          .eq('sku', sku)
          .is('deleted_at', null)
          .maybeSingle()
        if (product?.id) {
          productIds.add(product.id)
          skuToId.set(sku, product.id)
        }
      }
    }

    for (const row of orderItems || []) {
      const sku = row.product_sku ? String(row.product_sku).trim() : null
      if (!row.product_id && sku && skuToId.get(sku)) {
        productIds.add(skuToId.get(sku)!)
      }
    }

    const result: Record<string, ItemAvailabilityRow> = {}
    if (productIds.size === 0) {
      return NextResponse.json({ availability: result })
    }

    try {
      await supabase.rpc('refresh_stock_summary').catch(() => {})
    } catch {
      // ignore
    }

    const ids = [...productIds]
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

    // Incoming from open POs (draft, pending_approval, approved, partially_received)
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

    // Round incoming (PO-based only to avoid double-count with shipments)
    for (const pid of Object.keys(result)) {
      result[pid].quantity_incoming = Math.round((result[pid].quantity_incoming || 0) * 100) / 100
    }

    const sku_to_product_id: Record<string, string> = {}
    for (const [sku, id] of skuToId) {
      if (id) sku_to_product_id[sku] = id
    }
    return NextResponse.json({ availability: result, sku_to_product_id: sku_to_product_id })
  } catch (error) {
    console.error('Error in order item-availability API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
