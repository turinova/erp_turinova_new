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

/** For one buffer entry's order products, compute stock summary: 'all' | 'partial' | 'none' | 'unknown'. */
async function getStockSummaryForEntry(
  supabase: any,
  orderProducts: { sku?: string; quantity?: string | number }[]
): Promise<'all' | 'partial' | 'none' | 'unknown'> {
  if (!orderProducts?.length) return 'unknown'
  let allOk = true
  let anyOk = false
  let anyResolved = false

  for (let i = 0; i < orderProducts.length; i++) {
    const row = orderProducts[i]
    const sku = row.sku ? String(row.sku).trim() : null
    const qtyOrdered = Math.max(0, parseInt(String(row.quantity || 1), 10) || 1)
    if (!sku) {
      allOk = false
      continue
    }

    const { data: product } = await supabase
      .from('shoprenter_products')
      .select('id')
      .eq('sku', sku)
      .is('deleted_at', null)
      .maybeSingle()

    if (!product?.id) {
      allOk = false
      anyResolved = true
      continue
    }

    const { data: stockRows } = await supabase
      .from('stock_summary')
      .select('quantity_available')
      .eq('product_id', product.id)

    const totalAvailable = (stockRows || []).reduce((sum: number, r: any) => sum + (Number(r.quantity_available) || 0), 0)
    anyResolved = true
    if (totalAvailable >= qtyOrdered) anyOk = true
    else allOk = false
  }

  if (!anyResolved) return 'unknown'
  if (allOk && anyOk) return 'all'
  if (anyOk) return 'partial'
  return 'none'
}

/**
 * GET /api/orders/buffer/stock-summaries?ids=id1,id2,...
 * Returns { [bufferId]: 'all' | 'partial' | 'none' | 'unknown' } for each id.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const idsParam = request.nextUrl.searchParams.get('ids')
    const ids = idsParam ? idsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 50) : []
    if (ids.length === 0) {
      return NextResponse.json({ summaries: {} })
    }

    const { data: rows, error } = await supabase
      .from('order_buffer')
      .select('id, webhook_data')
      .in('id', ids)

    if (error) {
      console.error('[BUFFER] stock-summaries fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const summaries: Record<string, 'all' | 'partial' | 'none' | 'unknown'> = {}
    for (const row of rows || []) {
      const webhookData = row.webhook_data || {}
      const orderData = webhookData?.orders?.order?.[0] || webhookData?.order || webhookData
      const orderProducts = normalizeOrderProducts(orderData)
      summaries[row.id] = await getStockSummaryForEntry(supabase, orderProducts)
    }

    return NextResponse.json({ summaries })
  } catch (error) {
    console.error('[BUFFER] stock-summaries error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
