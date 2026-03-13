import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

function normalizeOrderProducts(orderData: any): any[] {
  const raw = orderData?.orderProducts
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  const inner = raw.orderProduct
  if (inner == null) return []
  return Array.isArray(inner) ? inner : [inner]
}

export interface StockDetailItem {
  product_name: string
  quantity_ordered: number
  quantity_available: number
  quantity_needed: number
}

/**
 * GET /api/orders/buffer/[id]/stock-detail
 * Returns items with product name, ordered qty, available qty, needed qty (for popover table).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: row, error } = await supabase
      .from('order_buffer')
      .select('webhook_data')
      .eq('id', id)
      .single()

    if (error || !row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const webhookData = row.webhook_data || {}
    const orderData = webhookData?.orders?.order?.[0] || webhookData?.order || webhookData
    const orderProducts = normalizeOrderProducts(orderData)

    const items: StockDetailItem[] = []

    for (let i = 0; i < orderProducts.length; i++) {
      const p = orderProducts[i]
      const name = p.name ? String(p.name).trim() : '—'
      const qtyOrdered = Math.max(0, parseInt(String(p.quantity || 1), 10) || 1)
      const sku = p.sku ? String(p.sku).trim() : null

      let quantity_available = 0
      if (sku) {
        const { data: product } = await supabase
          .from('shoprenter_products')
          .select('id')
          .eq('sku', sku)
          .is('deleted_at', null)
          .maybeSingle()
        if (product?.id) {
          const { data: stockRows } = await supabase
            .from('stock_summary')
            .select('quantity_available')
            .eq('product_id', product.id)
          quantity_available = (stockRows || []).reduce((sum: number, r: any) => sum + (Number(r.quantity_available) || 0), 0)
        }
      }

      items.push({
        product_name: name,
        quantity_ordered: qtyOrdered,
        quantity_available,
        quantity_needed: qtyOrdered
      })
    }

    return NextResponse.json({ items })
  } catch (error) {
    console.error('[BUFFER] stock-detail error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
