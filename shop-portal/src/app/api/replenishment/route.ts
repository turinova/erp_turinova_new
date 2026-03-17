import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/** Order statuses that can still have open demand (not yet shipped/delivered/cancelled) */
const OPEN_ORDER_STATUSES = ['new', 'picking', 'picked', 'verifying', 'packing']
const SHORTAGE_FULFILLABILITY = ['not_fulfillable', 'partially_fulfillable']

export interface ReplenishmentLine {
  order_item_id: string
  order_id: string
  order_number: string
  product_id: string | null
  product_sku: string
  product_name: string
  quantity: number
}

export interface ReplenishmentProductRow {
  product_id: string
  product_sku: string
  product_name: string
  quantity: number
  order_item_ids: string[]
  order_ids: string[]
  order_numbers: string[]
  supplier_id: string | null
  supplier_name: string | null
  has_supplier: boolean
}

/**
 * GET /api/replenishment
 * List demand lines (order items short and not yet on a PO).
 * Query: group_by=product|line, order_id?, supplier_id?
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const groupBy = searchParams.get('group_by') || 'product'
    const orderId = searchParams.get('order_id')?.trim() || null
    const supplierId = searchParams.get('supplier_id')?.trim() || null

    // 1. Load orders that have shortage and are still open
    let ordersQuery = supabase
      .from('orders')
      .select('id, order_number')
      .is('deleted_at', null)
      .in('status', OPEN_ORDER_STATUSES)
      .in('fulfillability_status', SHORTAGE_FULFILLABILITY)

    if (orderId) ordersQuery = ordersQuery.eq('id', orderId)
    const { data: orders, error: ordersError } = await ordersQuery

    if (ordersError) {
      console.error('Replenishment orders error:', ordersError)
      return NextResponse.json({ error: ordersError.message }, { status: 500 })
    }
    if (!orders?.length) {
      return NextResponse.json({ lines: [], totalCount: 0, group_by: groupBy })
    }

    const orderIds = orders.map((o: { id: string }) => o.id)
    const orderMap = new Map(orders.map((o: { id: string; order_number: string }) => [o.id, o.order_number]))

    // 2. Load order_items: not deleted, not on PO, belong to these orders
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('id, order_id, product_id, product_sku, product_name, quantity')
      .in('order_id', orderIds)
      .is('deleted_at', null)
      .is('purchase_order_id', null)

    if (itemsError) {
      console.error('Replenishment items error:', itemsError)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    const rawLines: ReplenishmentLine[] = (items || []).map((row: any) => ({
      order_item_id: row.id,
      order_id: row.order_id,
      order_number: orderMap.get(row.order_id) || '',
      product_id: row.product_id ?? null,
      product_sku: row.product_sku || '',
      product_name: row.product_name || '',
      quantity: parseInt(String(row.quantity), 10) || 0
    }))

    // Filter by supplier: keep only lines whose product has this supplier
    let lines = rawLines
    if (supplierId && rawLines.length > 0) {
      const productIds = [...new Set(rawLines.map((l) => l.product_id).filter(Boolean))] as string[]
      if (productIds.length > 0) {
        const { data: ps } = await supabase
          .from('product_suppliers')
          .select('product_id')
          .eq('supplier_id', supplierId)
          .in('product_id', productIds)
          .is('deleted_at', null)
        const allowedProductIds = new Set((ps || []).map((r: any) => r.product_id))
        lines = rawLines.filter((l) => l.product_id && allowedProductIds.has(l.product_id))
      } else {
        lines = []
      }
    }

    if (groupBy === 'line') {
      // Enrich with product/supplier for display (optional)
      const productIds = [...new Set(lines.map((l) => l.product_id).filter(Boolean))] as string[]
      let productMap = new Map<string, { name: string; sku: string }>()
      let supplierMap = new Map<string, { supplier_id: string; supplier_name: string }>()
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('shoprenter_products')
          .select('id, name, sku')
          .in('id', productIds)
          .is('deleted_at', null)
        productMap = new Map((products || []).map((p: any) => [p.id, { name: p.name || '', sku: p.sku || '' }]))
        const { data: psList } = await supabase
          .from('product_suppliers')
          .select('product_id, supplier_id, suppliers:supplier_id(id, name)')
          .in('product_id', productIds)
          .eq('is_preferred', true)
          .is('deleted_at', null)
        for (const ps of psList || []) {
          const s = (ps as any).suppliers
          if (ps.product_id && s) supplierMap.set(ps.product_id, { supplier_id: s.id, supplier_name: s.name || '' })
        }
      }
      const enriched = lines.map((l) => {
        const prod = l.product_id ? productMap.get(l.product_id) : null
        const sup = l.product_id ? supplierMap.get(l.product_id) : null
        return {
          ...l,
          product_name: prod?.name ?? l.product_name,
          product_sku: prod?.sku ?? l.product_sku,
          supplier_id: sup?.supplier_id ?? null,
          supplier_name: sup?.supplier_name ?? null,
          has_supplier: !!sup
        }
      })
      return NextResponse.json({ lines: enriched, totalCount: enriched.length, group_by: 'line' })
    }

    // group_by=product: only lines with product_id (can add to PO)
    const linesWithProduct = lines.filter((l) => l.product_id != null)
    const byProduct = new Map<string, { quantity: number; order_item_ids: string[]; order_ids: string[]; order_numbers: string[] }>()
    for (const l of linesWithProduct) {
      const key = l.product_id!
      if (!byProduct.has(key)) {
        byProduct.set(key, { quantity: 0, order_item_ids: [], order_ids: [], order_numbers: [] })
      }
      const rec = byProduct.get(key)!
      rec.quantity += l.quantity
      rec.order_item_ids.push(l.order_item_id)
      if (!rec.order_ids.includes(l.order_id)) {
        rec.order_ids.push(l.order_id)
        rec.order_numbers.push(l.order_number)
      }
    }

    const productIds = [...byProduct.keys()]
    const productRows: ReplenishmentProductRow[] = []
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('shoprenter_products')
        .select('id, name, sku')
        .in('id', productIds)
        .is('deleted_at', null)
      const productInfoMap = new Map((products || []).map((p: any) => [p.id, { name: p.name || '', sku: p.sku || '' }]))

      const { data: psList } = await supabase
        .from('product_suppliers')
        .select('product_id, supplier_id, is_preferred, suppliers:supplier_id(id, name)')
        .in('product_id', productIds)
        .is('deleted_at', null)
        .eq('is_active', true)

      const supplierByProduct = new Map<string, { supplier_id: string; supplier_name: string }>()
      for (const ps of psList || []) {
        const p = ps as any
        const pid = p.product_id
        if (!pid) continue
        const s = p.suppliers
        if (!s) continue
        if (!supplierId || s.id === supplierId) {
          if (!supplierByProduct.has(pid) || p.is_preferred) {
            supplierByProduct.set(pid, { supplier_id: s.id, supplier_name: s.name || '' })
          }
        }
      }

      for (const pid of productIds) {
        const rec = byProduct.get(pid)!
        const info = productInfoMap.get(pid) || { name: '', sku: '' }
        const sup = supplierByProduct.get(pid) || null
        productRows.push({
          product_id: pid,
          product_sku: info.sku,
          product_name: info.name,
          quantity: rec.quantity,
          order_item_ids: rec.order_item_ids,
          order_ids: rec.order_ids,
          order_numbers: rec.order_numbers,
          supplier_id: sup?.supplier_id ?? null,
          supplier_name: sup?.supplier_name ?? null,
          has_supplier: !!sup
        })
      }
    }

    // Lines without product_id (for optional "pair product" block)
    const linesWithoutProduct = lines.filter((l) => l.product_id == null)

    return NextResponse.json({
      lines: productRows,
      totalCount: productRows.length,
      group_by: 'product',
      lines_without_product: linesWithoutProduct.length > 0 ? linesWithoutProduct : undefined
    })
  } catch (error) {
    console.error('Replenishment GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
