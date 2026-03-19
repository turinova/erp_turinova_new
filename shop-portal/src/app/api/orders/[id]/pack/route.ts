import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getAllowedNextStatus } from '@/lib/order-status'
import { expressOneCreateLabels } from '@/lib/carriers/express-one'
import { sendOrderStatusEmailNotification } from '@/lib/order-status-notification-send'

/** Express One expects ISO 2-letter country code. Orders may store country name (e.g. Magyarország) in shipping_country_code. */
function normalizeCountryCodeForExpressOne(value: string): string {
  const v = value.trim().toUpperCase()
  if (v.length === 2 && /^[A-Z]{2}$/.test(v)) return v
  const byName: Record<string, string> = {
    MAGYARORSZÁG: 'HU',
    MAGYARORSZAG: 'HU',
    HUNGARY: 'HU',
    AUSZTRIA: 'AT',
    AUSTRIA: 'AT',
    SZLOVÁKIA: 'SK',
    SZLOVAKIA: 'SK',
    SLOVAKIA: 'SK',
    ROMÁNIA: 'RO',
    ROMANIA: 'RO',
    HORVÁTORSZÁG: 'HR',
    HORVATORSZAG: 'HR',
    CROATIA: 'HR',
    SZLOVÉNIA: 'SI',
    SLOVENIA: 'SI',
    UKRAINE: 'UA',
    UKRAJNA: 'UA',
    SERBIA: 'RS',
    SZERBIA: 'RS',
    GERMANY: 'DE',
    NÉMETORSZÁG: 'DE',
    NEMETORSZAG: 'DE'
  }
  return byName[v] ?? byName[value.trim()] ?? 'HU'
}

/**
 * GET /api/orders/[id]/pack
 * Load order and lines for packing screen. If order is picked, set status to packing.
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

    const actingUserId = user.id

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        customer_email,
        shipping_firstname,
        shipping_lastname,
        shipping_company,
        shipping_address1,
        shipping_address2,
        shipping_city,
        shipping_postcode,
        shipping_country_code,
        shipping_method_id,
        shipping_method_name,
        tracking_number
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Rendelés nem található' }, { status: 404 })
    }

    const status = order.status as string
    if (status !== 'picked' && status !== 'packing') {
      return NextResponse.json(
        { error: 'Ez a rendelés nem csomagolható. Csak Kiszedve vagy Csomagolás állapotban.' },
        { status: 400 }
      )
    }

    // When opening pack screen, move picked → packing so queue shows "in progress"
    if (status === 'picked') {
      await supabase
        .from('orders')
        .update({ status: 'packing', updated_at: new Date().toISOString() })
        .eq('id', id)
      const { data: { user: packUser } } = await supabase.auth.getUser()
      await sendOrderStatusEmailNotification(supabase, {
        orderId: id,
        previousStatus: 'picked',
        newStatus: 'packing',
        actingUserId: packUser?.id ?? null
      })
    }

    // Resolve is_pickup from shipping method (requires_pickup_point = store pickup)
    let is_pickup = false
    if (order.shipping_method_id) {
      const { data: sm } = await supabase
        .from('shipping_methods')
        .select('requires_pickup_point')
        .eq('id', order.shipping_method_id)
        .single()
      is_pickup = sm?.requires_pickup_point === true
    }

    const { data: orderItems } = await supabase
      .from('order_items')
      .select('id, product_id, product_name, product_sku, product_gtin, product_image_url, quantity')
      .eq('order_id', id)
      .is('deleted_at', null)
      .order('id', { ascending: true })

    const productIds = [...new Set((orderItems || []).map((i: any) => i.product_id).filter(Boolean))]
    const productBarcodes: Map<string, { gtin: string | null; internal_barcode: string | null }> = new Map()
    const productImages: Map<string, string> = new Map()
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
      ;(imagesRes.data || []).forEach((img: any) => {
        if (img.product_id && img.image_url && !productImages.has(img.product_id)) {
          productImages.set(img.product_id, img.image_url)
        }
      })
    }

    const lines = (orderItems || []).map((item: any) => {
      const fromProduct = item.product_id ? productBarcodes.get(item.product_id) : null
      const gtin = item.product_gtin || fromProduct?.gtin || ''
      const internal_barcode = fromProduct?.internal_barcode ?? ''
      const imageUrl = item.product_image_url || (item.product_id ? productImages.get(item.product_id) : null) || null
      return {
        order_item_id: item.id,
        product_id: item.product_id || null,
        product_name: item.product_name,
        product_sku: item.product_sku,
        product_gtin: gtin,
        internal_barcode: internal_barcode,
        product_image_url: imageUrl,
        quantity: item.quantity
      }
    })

    return NextResponse.json({
      order: {
        id: order.id,
        order_number: order.order_number,
        status: 'packing',
        customer_email: order.customer_email,
        shipping_firstname: order.shipping_firstname,
        shipping_lastname: order.shipping_lastname,
        shipping_company: order.shipping_company,
        shipping_address1: order.shipping_address1,
        shipping_address2: order.shipping_address2,
        shipping_city: order.shipping_city,
        shipping_postcode: order.shipping_postcode,
        shipping_country_code: order.shipping_country_code,
        shipping_method_id: order.shipping_method_id,
        shipping_method_name: order.shipping_method_name,
        tracking_number: order.tracking_number,
        is_pickup
      },
      lines
    })
  } catch (err) {
    console.error('Error in pack GET:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/orders/[id]/pack/complete
 * Validate scanned quantities; set status to shipped or ready_for_pickup; set shipped_at / tracking_number.
 */
export async function POST(
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

    const body = await request.json().catch(() => ({}))
    const scanned: Record<string, number> = body.scanned && typeof body.scanned === 'object' ? body.scanned : {}
    let tracking_number: string | null = body.tracking_number != null ? String(body.tracking_number).trim() || null : null

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, shipping_method_id, customer_email,
        shipping_firstname, shipping_lastname, shipping_company,
        shipping_address1, shipping_address2, shipping_city, shipping_postcode, shipping_country_code,
        total_gross, payment_method_after
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Rendelés nem található' }, { status: 404 })
    }

    const status = order.status as string
    if (status !== 'picked' && status !== 'packing') {
      return NextResponse.json(
        { error: 'A rendelés már feldolgozva vagy nem csomagolható.' },
        { status: 409 }
      )
    }

    const { data: orderItems } = await supabase
      .from('order_items')
      .select('id, quantity, product_id')
      .eq('order_id', id)
      .is('deleted_at', null)

    const items = orderItems || []
    for (const item of items) {
      const q = item.quantity as number
      const s = scanned[item.id] ?? 0
      if (s < q) {
        return NextResponse.json(
          { error: 'Nem minden tétel be lett olvasva. Csomag kész csak minden sor teljesítése után.' },
          { status: 400 }
        )
      }
    }

    let is_pickup = false
    let shippingMethod: { requires_pickup_point?: boolean; carrier_provider?: string | null; customer_code?: string | null; api_username?: string | null; api_password?: string | null } | null = null
    if (order.shipping_method_id) {
      const { data: sm } = await supabase
        .from('shipping_methods')
        .select('requires_pickup_point, carrier_provider, customer_code, api_username, api_password')
        .eq('id', order.shipping_method_id)
        .single()
      is_pickup = sm?.requires_pickup_point === true
      shippingMethod = sm
    }

    const newStatus = is_pickup ? 'ready_for_pickup' : 'awaiting_carrier'
    const allowed = getAllowedNextStatus(status)
    if (!allowed.includes(newStatus)) {
      return NextResponse.json({ error: 'Állapotváltás nem engedélyezett' }, { status: 400 })
    }

    let labelPdfBase64: string | undefined
    let expressOneError: string | undefined

    // Express One: create label only for carrier delivery when method is express_one and credentials exist
    if (!is_pickup && shippingMethod?.carrier_provider === 'express_one') {
      const companyId = (shippingMethod.customer_code ?? '').trim()
      const userName = (shippingMethod.api_username ?? '').trim()
      const password = (shippingMethod.api_password ?? '').trim()
      if (companyId && userName && password) {
        let weightKg = 1
        const productIds = [...new Set((items as { product_id: string | null }[]).map((i) => i.product_id).filter(Boolean))]
        if (productIds.length > 0) {
          const { data: products } = await supabase
            .from('shoprenter_products')
            .select('id, weight')
            .in('id', productIds)
          const weightByProduct = new Map((products || []).map((p: any) => [p.id, parseFloat(String(p.weight || 0)) || 0]))
          for (const item of items as { product_id: string | null; quantity: number }[]) {
            if (item.product_id) {
              const w = weightByProduct.get(item.product_id) ?? 0
              weightKg += w * (item.quantity || 0)
            }
          }
          if (weightKg < 1) weightKg = 1
        }

        const consigName = [order.shipping_firstname, order.shipping_lastname].filter(Boolean).join(' ') || order.shipping_company || 'Vevő'
        const street = [order.shipping_address1, order.shipping_address2].filter(Boolean).join(', ') || ''
        const postCode = String(order.shipping_postcode ?? '').replace(/\s/g, '').slice(0, 6)
        // Express One requires ISO 2-letter country code (e.g. HU). Order may store country name (e.g. Magyarország) in shipping_country_code.
        const rawCountry = (order.shipping_country_code || '').trim()
        const country = normalizeCountryCodeForExpressOne(rawCountry)

        const result = await expressOneCreateLabels({
          auth: { company_id: companyId, user_name: userName, password },
          post_date: new Date().toISOString().slice(0, 10),
          consig: {
            name: consigName,
            contact_name: order.shipping_company || undefined,
            city: (order.shipping_city || '').slice(0, 25),
            street: street.slice(0, 100),
            country,
            post_code: postCode
          },
          parcels: { type: 0, qty: 1, weight: weightKg },
          services: {
            delivery_type: '24H',
            ...(order.payment_method_after === true && order.total_gross > 0 && { cod: { amount: String(Math.round(Number(order.total_gross))) } }),
            ...(order.customer_email && { notification: { email: String(order.customer_email).slice(0, 100) } })
          },
          ref_number: (order.order_number || id).slice(0, 50)
        })

        if (result.ok && result.parcel_numbers?.length) {
          tracking_number = result.parcel_numbers[0]
          if (result.label_pdf_base64) labelPdfBase64 = result.label_pdf_base64
        } else {
          expressOneError = result.error || 'Címke nem kérhető'
          console.error('[pack] Express One create_labels failed:', result.error, result.code)
        }
      }
    }

    const update: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString()
    }
    if (tracking_number != null) update.tracking_number = tracking_number
    if (newStatus === 'shipped') {
      update.shipped_at = new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update(update)
      .eq('id', id)

    if (updateError) {
      console.error('Pack complete update error:', updateError)
      return NextResponse.json({ error: 'Nem sikerült frissíteni a rendelést' }, { status: 500 })
    }

    await sendOrderStatusEmailNotification(supabase, {
      orderId: id,
      previousStatus: status,
      newStatus: newStatus,
      actingUserId: user.id
    })

    const message = is_pickup
      ? 'Rendelés személyes átvételre vár.'
      : labelPdfBase64
        ? 'Címke kész. Nyomtathatod a megjelenő ablakból.'
        : expressOneError
          ? `Rendelés futárra vár. (${expressOneError})`
          : 'Rendelés futárra vár.'

    return NextResponse.json({
      success: true,
      status: newStatus,
      message,
      ...(labelPdfBase64 && { labelPdfBase64 }),
      ...(tracking_number && { trackingNumber: tracking_number }),
      ...(expressOneError && { express_one_error: expressOneError })
    })
  } catch (err) {
    console.error('Error in pack complete POST:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
