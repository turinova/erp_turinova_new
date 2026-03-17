import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/pick-batches/[id]/pick-list
 * Flat list of order items to pick for this batch (no shelf location).
 * Ordered by order_number, then product_sku for consistent PDA flow.
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

    const { data: batch, error: batchError } = await supabase
      .from('pick_batches')
      .select('id, code, status')
      .eq('id', id)
      .single()

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Begyűjtés nem található' }, { status: 404 })
    }

    if (batch.status !== 'in_progress') {
      return NextResponse.json(
        { error: 'Csak folyamatban lévő begyűjtéshez lehet szkennelni' },
        { status: 400 }
      )
    }

    const { data: batchOrders } = await supabase
      .from('pick_batch_orders')
      .select('order_id')
      .eq('pick_batch_id', id)
      .order('created_at', { ascending: true })

    const orderIds = (batchOrders || []).map((r: any) => r.order_id)
    if (orderIds.length === 0) {
      return NextResponse.json({ pick_batch: { id: batch.id, code: batch.code }, lines: [] })
    }

    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_number')
      .in('id', orderIds)
      .is('deleted_at', null)

    const orderMap = new Map((orders || []).map((o: any) => [o.id, o]))

    const { data: orderItems } = await supabase
      .from('order_items')
      .select('id, order_id, product_id, product_name, product_sku, product_gtin, product_image_url, quantity')
      .in('order_id', orderIds)
      .is('deleted_at', null)

    const productIds = [...new Set((orderItems || []).map((i: any) => i.product_id).filter(Boolean))]
    let productBarcodes: Map<string, { gtin: string | null; internal_barcode: string | null }> = new Map()
    let productImages: Map<string, string> = new Map()
    if (productIds.length > 0) {
      const [productsRes, imagesRes] = await Promise.all([
        supabase.from('shoprenter_products').select('id, gtin, internal_barcode').in('id', productIds),
        supabase
          .from('product_images')
          .select('product_id, image_url, is_main_image, sort_order')
          .in('product_id', productIds)
          .order('is_main_image', { ascending: false })
          .order('sort_order', { ascending: true })
      ])
      ;(productsRes.data || []).forEach((p: any) => {
        productBarcodes.set(p.id, {
          gtin: p.gtin ?? null,
          internal_barcode: p.internal_barcode ?? null
        })
      })
      // First image per product (main preferred, then by sort_order)
      ;(imagesRes.data || []).forEach((img: any) => {
        if (img.product_id && img.image_url && !productImages.has(img.product_id)) {
          productImages.set(img.product_id, img.image_url)
        }
      })
    }

    const lines = (orderItems || [])
      .map((item: any) => {
        const fromProduct = item.product_id ? productBarcodes.get(item.product_id) : null
        const gtin = item.product_gtin || fromProduct?.gtin || ''
        const internal_barcode = fromProduct?.internal_barcode ?? ''
        const imageUrl = item.product_image_url || (item.product_id ? productImages.get(item.product_id) : null) || null
        return {
          order_item_id: item.id,
          order_id: item.order_id,
          product_id: item.product_id || null,
          order_number: orderMap.get(item.order_id)?.order_number || '',
          product_name: item.product_name,
          product_sku: item.product_sku,
          product_gtin: gtin,
          internal_barcode: internal_barcode,
          product_image_url: imageUrl,
          quantity: item.quantity
        }
      })
      .sort((a: any, b: any) => {
        const o = (a.order_number || '').localeCompare(b.order_number || '')
        if (o !== 0) return o
        return (a.product_sku || '').localeCompare(b.product_sku || '')
      })

    return NextResponse.json({
      pick_batch: { id: batch.id, code: batch.code },
      lines
    })
  } catch (err) {
    console.error('Error in pick-list GET:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
