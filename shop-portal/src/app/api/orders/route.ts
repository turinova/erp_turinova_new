import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { generateOrderNumber } from '@/lib/order-number'
import { recomputeOrderTotalsFromItems, upsertStandardOrderTotalsRows } from '@/lib/order-totals-recompute'
import { reconcileOrderStockAfterLineItemsSave } from '@/lib/order-items-stock-reconcile'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Body = {
  customer_person_id?: string | null
  customer_company_id?: string | null
  customer_company_name?: string | null
  customer_firstname?: string | null
  customer_lastname?: string | null
  customer_email?: string | null
  customer_phone?: string | null
  billing_firstname?: string
  billing_lastname?: string
  billing_company?: string | null
  billing_address1?: string
  billing_address2?: string | null
  billing_city?: string
  billing_postcode?: string
  billing_country_code?: string | null
  billing_tax_number?: string | null
  shipping_firstname: string
  shipping_lastname: string
  shipping_company?: string | null
  shipping_address1: string
  shipping_address2?: string | null
  shipping_city: string
  shipping_postcode: string
  shipping_country_code?: string | null
  shipping_method_id?: string | null
  payment_method_id?: string | null
  payment_method_after?: boolean
  currency_code?: string
  customer_comment?: string | null
  internal_notes?: string | null
  order_discount_amount?: number | null
  order_discount_percent?: number | null
  items: Array<{
    product_id?: string
    product_name: string
    product_sku: string
    quantity: number
    unit_price_gross: number
    tax_rate: number
    discount_amount?: number
    discount_percent?: number
  }>
}

/**
 * POST /api/orders
 * Create a manual ERP-only order (no webshop connection / platform ids). No customer e-mail on status "new".
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as Body
    const items = Array.isArray(body.items) ? body.items : []

    if (items.length === 0) {
      return NextResponse.json({ error: 'Legalább egy tétel szükséges' }, { status: 400 })
    }

    for (const item of items) {
      if (!item.product_name || item.product_sku == null) {
        return NextResponse.json({ error: 'Minden tételnek kell terméknév és cikkszám' }, { status: 400 })
      }
      const qty = parseInt(String(item.quantity), 10)
      if (isNaN(qty) || qty <= 0) {
        return NextResponse.json({ error: 'A mennyiségnek pozitív egésznek kell lennie' }, { status: 400 })
      }
      const gross = parseFloat(String(item.unit_price_gross))
      if (isNaN(gross) || gross < 0) {
        return NextResponse.json({ error: 'Az egységár (bruttó) nem lehet negatív' }, { status: 400 })
      }
      const taxRate = parseFloat(String(item.tax_rate))
      if (isNaN(taxRate) || taxRate < 0) {
        return NextResponse.json({ error: 'Az ÁFA kulcs nem lehet negatív' }, { status: 400 })
      }
      if (!item.product_id) {
        return NextResponse.json({ error: 'Új tételhez termék kiválasztása kötelező (product_id)' }, { status: 400 })
      }
      const discAmt = parseFloat(String(item.discount_amount ?? 0)) || 0
      const discPct = item.discount_percent != null ? parseFloat(String(item.discount_percent)) : null
      if (discAmt < 0 || (discPct != null && (discPct < 0 || discPct > 100))) {
        return NextResponse.json(
          { error: 'A tétel kedvezmény nem lehet negatív, és a százalék 0–100 között kell legyen' },
          { status: 400 }
        )
      }
    }

    const currencyCode = (body.currency_code || 'HUF').toUpperCase()
    const isHuf = currencyCode === 'HUF'
    const roundHuf = (x: number) => (isHuf ? Math.round(x) : Math.round(x * 100) / 100)

    const requiredAddr = (v: string | undefined | null, label: string) => {
      const s = (v ?? '').trim()
      if (!s) return label
      return null
    }

    const addrErrors = [
      requiredAddr(body.shipping_firstname, 'Szállítás: keresztnév kötelező'),
      requiredAddr(body.shipping_lastname, 'Szállítás: vezetéknév kötelező'),
      requiredAddr(body.shipping_address1, 'Szállítás: cím kötelező'),
      requiredAddr(body.shipping_city, 'Szállítás: város kötelező'),
      requiredAddr(body.shipping_postcode, 'Szállítás: irányítószám kötelező')
    ].filter(Boolean) as string[]

    if (addrErrors.length > 0) {
      return NextResponse.json({ error: addrErrors[0] }, { status: 400 })
    }

    const emailRaw = (body.customer_email ?? '').trim().toLowerCase()
    if (!emailRaw || !EMAIL_RE.test(emailRaw)) {
      return NextResponse.json({ error: 'Érvényes vevő e-mail cím kötelező (kapcsolattartás és egyeztetés)' }, { status: 400 })
    }

    let customerPersonId: string | null = body.customer_person_id ? String(body.customer_person_id).trim() : null
    let customerCompanyId: string | null = body.customer_company_id ? String(body.customer_company_id).trim() : null
    let customerCompanyName: string | null = (body.customer_company_name ?? '').trim() || null

    if (customerPersonId && customerCompanyId) {
      return NextResponse.json({ error: 'Egyszerre csak személy vagy cég rendelhető' }, { status: 400 })
    }

    if (!customerPersonId && !customerCompanyId) {
      const { data: personByEmail } = await supabase
        .from('customer_persons')
        .select('id')
        .eq('email', emailRaw)
        .is('deleted_at', null)
        .maybeSingle()

      const { data: companyByEmail } = await supabase
        .from('customer_companies')
        .select('id, name')
        .eq('email', emailRaw)
        .is('deleted_at', null)
        .maybeSingle()

      if (personByEmail && companyByEmail) {
        return NextResponse.json(
          { error: 'Ez az e-mail személyhez és céghez is tartozik. Válasszon vevőt a keresőből.' },
          { status: 409 }
        )
      }

      if (personByEmail) {
        customerPersonId = personByEmail.id
      } else if (companyByEmail) {
        customerCompanyId = companyByEmail.id
        customerCompanyName = companyByEmail.name ?? customerCompanyName
      } else {
        const fn = (body.customer_firstname ?? '').trim()
        const ln = (body.customer_lastname ?? '').trim()
        if (!fn || !ln) {
          return NextResponse.json(
            { error: 'Új vevőhöz keresztnév és vezetéknév kötelező (vagy válasszon meglévő vevőt)' },
            { status: 400 }
          )
        }
        const { data: createdPerson, error: createErr } = await supabase
          .from('customer_persons')
          .insert({
            firstname: fn,
            lastname: ln,
            email: emailRaw,
            telephone: (body.customer_phone ?? '').trim() || null,
            source: 'local',
            is_active: true
          })
          .select('id')
          .single()

        if (createErr || !createdPerson) {
          return NextResponse.json(
            { error: createErr?.message || 'Nem sikerült létrehozni a vevőt' },
            { status: 400 }
          )
        }
        customerPersonId = createdPerson.id
      }
    } else if (customerPersonId) {
      const { data: p } = await supabase
        .from('customer_persons')
        .select('id')
        .eq('id', customerPersonId)
        .is('deleted_at', null)
        .maybeSingle()
      if (!p) {
        return NextResponse.json({ error: 'A kiválasztott személy nem található' }, { status: 400 })
      }
    } else if (customerCompanyId) {
      const { data: c } = await supabase
        .from('customer_companies')
        .select('id, name')
        .eq('id', customerCompanyId)
        .is('deleted_at', null)
        .maybeSingle()
      if (!c) {
        return NextResponse.json({ error: 'A kiválasztott cég nem található' }, { status: 400 })
      }
      customerCompanyName = c.name ?? customerCompanyName
    }

    let customerFirstname = (body.customer_firstname ?? '').trim()
    let customerLastname = (body.customer_lastname ?? '').trim()
    if (customerCompanyId) {
      customerFirstname = customerFirstname || ''
      customerLastname = customerLastname || ''
    } else {
      if (!customerFirstname || !customerLastname) {
        return NextResponse.json({ error: 'Vevő keresztnév és vezetéknév kötelező' }, { status: 400 })
      }
    }

    const shippingMethodId = body.shipping_method_id ? String(body.shipping_method_id).trim() : null
    const paymentMethodId = body.payment_method_id ? String(body.payment_method_id).trim() : null

    let shippingMethodName: string | null = null
    let shippingMethodCode: string | null = null
    if (shippingMethodId) {
      const { data: sm } = await supabase
        .from('shipping_methods')
        .select('name, code')
        .eq('id', shippingMethodId)
        .is('deleted_at', null)
        .maybeSingle()
      if (sm) {
        shippingMethodName = sm.name ?? null
        shippingMethodCode = sm.code ?? null
      }
    }

    let paymentMethodName: string | null = null
    let paymentMethodCode: string | null = null
    if (paymentMethodId) {
      const { data: pm } = await supabase
        .from('payment_methods')
        .select('name, code')
        .eq('id', paymentMethodId)
        .is('deleted_at', null)
        .maybeSingle()
      if (pm) {
        paymentMethodName = pm.name ?? null
        paymentMethodCode = pm.code ?? null
      }
    }

    if (!shippingMethodId || !paymentMethodId) {
      return NextResponse.json(
        { error: 'Szállítási mód és fizetési mód megadása kötelező' },
        { status: 400 }
      )
    }
    if (!shippingMethodName || !paymentMethodName) {
      return NextResponse.json(
        { error: 'Érvénytelen szállítási vagy fizetési mód' },
        { status: 400 }
      )
    }

    const orderDiscountAmount = body.order_discount_amount != null ? parseFloat(String(body.order_discount_amount)) : null
    const orderDiscountPercent = body.order_discount_percent != null ? parseFloat(String(body.order_discount_percent)) : null

    const orderNumber = await generateOrderNumber(supabase)

    const billingFirstname = (body.billing_firstname ?? '').trim() || (body.shipping_firstname ?? '').trim()
    const billingLastname = (body.billing_lastname ?? '').trim() || (body.shipping_lastname ?? '').trim()
    const billingAddress1 = (body.billing_address1 ?? '').trim() || (body.shipping_address1 ?? '').trim()
    const billingCity = (body.billing_city ?? '').trim() || (body.shipping_city ?? '').trim()
    const billingPostcode = (body.billing_postcode ?? '').trim() || (body.shipping_postcode ?? '').trim()
    const billingCountryCode = (body.billing_country_code ?? '').trim() || (body.shipping_country_code ?? '').trim() || null

    const insertRow: Record<string, unknown> = {
      connection_id: null,
      platform_order_id: null,
      platform_order_resource_id: null,
      order_number: orderNumber,
      customer_person_id: customerPersonId,
      customer_company_id: customerCompanyId,
      customer_company_name: customerCompanyId ? customerCompanyName : null,
      customer_firstname: customerCompanyId ? (customerFirstname || null) : customerFirstname,
      customer_lastname: customerCompanyId ? (customerLastname || null) : customerLastname,
      customer_email: emailRaw,
      customer_phone: (body.customer_phone ?? '').trim() || null,
      billing_firstname: billingFirstname,
      billing_lastname: billingLastname,
      billing_company: (body.billing_company ?? '').trim() || null,
      billing_address1: billingAddress1,
      billing_address2: (body.billing_address2 ?? '').trim() || null,
      billing_city: billingCity,
      billing_postcode: billingPostcode,
      billing_country_code: billingCountryCode,
      billing_tax_number: customerCompanyId ? ((body.billing_tax_number ?? '').trim() || null) : null,
      shipping_firstname: body.shipping_firstname.trim(),
      shipping_lastname: body.shipping_lastname.trim(),
      shipping_company: (body.shipping_company ?? '').trim() || null,
      shipping_address1: body.shipping_address1.trim(),
      shipping_address2: (body.shipping_address2 ?? '').trim() || null,
      shipping_city: body.shipping_city.trim(),
      shipping_postcode: body.shipping_postcode.trim(),
      shipping_country_code: (body.shipping_country_code ?? '').trim() || null,
      shipping_method_id: shippingMethodId,
      shipping_method_name: shippingMethodName,
      shipping_method_code: shippingMethodCode,
      shipping_total_net: 0,
      shipping_total_gross: 0,
      shipping_net_price: 0,
      shipping_gross_price: 0,
      payment_method_id: paymentMethodId,
      payment_method_name: paymentMethodName,
      payment_method_code: paymentMethodCode,
      payment_method_after: body.payment_method_after !== false,
      payment_status: 'pending',
      payment_total_net: 0,
      payment_total_gross: 0,
      subtotal_net: 0,
      subtotal_gross: 0,
      tax_amount: 0,
      discount_amount: 0,
      total_net: 0,
      total_gross: 0,
      currency_code: currencyCode,
      status: 'new',
      fulfillability_status: 'unknown',
      customer_comment: (body.customer_comment ?? '').trim() || null,
      internal_notes: (body.internal_notes ?? '').trim() || null,
      language_code: 'hu',
      order_date: new Date().toISOString()
    }

    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert(insertRow)
      .select()
      .single()

    if (orderError || !newOrder) {
      return NextResponse.json({ error: orderError?.message || 'Rendelés létrehozása sikertelen' }, { status: 400 })
    }

    const orderId = newOrder.id as string

    for (const it of items) {
      const quantity = parseInt(String(it.quantity), 10)
      const unitPriceGross = parseFloat(String(it.unit_price_gross))
      const taxRate = parseFloat(String(it.tax_rate))
      const lineGrossBeforeDiscount = unitPriceGross * quantity
      let itemDiscountAmount = parseFloat(String(it.discount_amount ?? 0)) || 0
      if (it.discount_percent != null) {
        const pct = parseFloat(String(it.discount_percent))
        if (!isNaN(pct)) itemDiscountAmount = roundHuf(lineGrossBeforeDiscount * pct / 100)
      }
      itemDiscountAmount = Math.max(0, Math.min(itemDiscountAmount, lineGrossBeforeDiscount))
      const lineGrossAfterDiscount = lineGrossBeforeDiscount - itemDiscountAmount
      const lineTotalGross = roundHuf(lineGrossAfterDiscount)
      const vatAmount = taxRate > 0 ? roundHuf(lineTotalGross * taxRate / (100 + taxRate)) : 0
      const lineTotalNet = lineTotalGross - vatAmount
      const unitPriceNet = quantity > 0 && taxRate > 0
        ? (unitPriceGross / (1 + taxRate / 100))
        : unitPriceGross

      const { error: insErr } = await supabase.from('order_items').insert({
        order_id: orderId,
        product_id: it.product_id || null,
        product_name: it.product_name,
        product_sku: it.product_sku,
        quantity,
        unit_price_net: unitPriceNet,
        unit_price_gross: unitPriceGross,
        tax_rate: taxRate,
        discount_amount: itemDiscountAmount,
        line_total_net: lineTotalNet,
        line_total_gross: lineTotalGross,
        status: 'pending',
        fulfillability_status: 'unknown'
      })

      if (insErr) {
        await supabase.from('orders').update({ deleted_at: new Date().toISOString() }).eq('id', orderId)
        return NextResponse.json({ error: insErr.message || 'Tétel beszúrása sikertelen' }, { status: 500 })
      }
    }

    if (orderDiscountPercent != null && !isNaN(orderDiscountPercent)) {
      const { data: activeItems } = await supabase
        .from('order_items')
        .select('line_total_gross')
        .eq('order_id', orderId)
        .is('deleted_at', null)
      let subtotalGross = 0
      for (const row of activeItems || []) {
        subtotalGross += parseFloat(String(row.line_total_gross)) || 0
      }
      subtotalGross = roundHuf(subtotalGross)
      const d = Math.max(0, roundHuf(subtotalGross * orderDiscountPercent / 100))
      await supabase.from('orders').update({ discount_amount: d, updated_at: new Date().toISOString() }).eq('id', orderId)
    } else if (orderDiscountAmount != null && !isNaN(orderDiscountAmount)) {
      await supabase
        .from('orders')
        .update({
          discount_amount: Math.max(0, roundHuf(orderDiscountAmount)),
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
    }

    await recomputeOrderTotalsFromItems(supabase, orderId)
    await upsertStandardOrderTotalsRows(supabase, orderId)

    await supabase.from('order_status_history').insert({
      order_id: orderId,
      status: 'new',
      platform_status_id: null,
      platform_status_text: null,
      changed_by: user.id,
      changed_at: new Date().toISOString(),
      source: 'manual'
    })

    const reconcileResult = await reconcileOrderStockAfterLineItemsSave(supabase, orderId, { createdBy: user.id })

    const { data: finalOrder } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (!reconcileResult.ok) {
      return NextResponse.json(
        {
          order: finalOrder,
          order_id: orderId,
          warning: reconcileResult.error || 'A rendelés létrejött, de a készlet / teljesíthetőség frissítése nem sikerült teljesen. Nyissa meg a rendelést és mentse újra a tételeket.'
        },
        { status: 201 }
      )
    }

    const fulfill = String(finalOrder?.fulfillability_status ?? '')
    const stockWarning =
      fulfill === 'not_fulfillable' || fulfill === 'partially_fulfillable'
        ? 'A rendelés létrejött; egyes tételeknél hiány mutatkozik a készleten (részletek a tételeknél).'
        : null

    return NextResponse.json(
      {
        order: finalOrder,
        order_id: orderId,
        fulfillability_status: reconcileResult.fulfillability_status,
        stock_reserved: reconcileResult.stock_reserved,
        warning: stockWarning
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/orders error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
