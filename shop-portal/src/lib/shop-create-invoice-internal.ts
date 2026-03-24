/**
 * Shared Számlázz shop invoice creation (used by API route + buffer auto-proforma).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeSzamlazzApiUrl } from '@/lib/szamlazz-agent'
import { getSzamlazzConnectionById, getSzamlazzConnectionForOrder } from '@/lib/shop-szamlazz-connection'
import { shopOrderBillingName } from '@/lib/szamlazz-shop-order-invoice'
import {
  buildShopFinalInvoiceXml,
  calculateShopOrderTotalGross,
  type ShopInvoiceXmlSettings
} from '@/lib/szamlazz-shop-xml'

const RELATED_ORDER_TYPE = 'order' as const
const PROVIDER = 'szamlazz_hu'

export type CreateShopInvoiceResult =
  | { ok: true; invoiceNumber: string; invoice: unknown }
  | { ok: false; error: string; status: number; details?: string }

function mapBodyPaymentMethod(
  raw: string | undefined,
  orderCode: string | null | undefined
): ShopInvoiceXmlSettings['paymentMethod'] {
  const v = (raw || '').toLowerCase()
  if (v === 'cash' || v === 'bank_transfer' || v === 'card') {
    return v
  }
  const c = String(orderCode || '').toUpperCase()
  if (c.includes('COD') || c === 'CASH' || c === 'KP') return 'cash'
  if (c.includes('CARD')) return 'card'
  return 'bank_transfer'
}

export type CreateShopInvoiceInternalOptions = {
  /** Use this Számlázz connection instead of resolving from order (buffer auto-proforma). */
  forcedSzamlazzConnectionId?: string | null
}

/**
 * Create invoice via Számlázz Agent and persist `invoices` row.
 */
export async function createShopInvoiceInternal(
  supabase: SupabaseClient,
  orderId: string,
  body: Record<string, unknown>,
  options?: CreateShopInvoiceInternalOptions
): Promise<CreateShopInvoiceResult> {
  try {
    const dueDate: string =
      typeof body.dueDate === 'string' && body.dueDate
        ? body.dueDate
        : new Date().toISOString().split('T')[0]
    const fulfillmentDate: string | undefined =
      typeof body.fulfillmentDate === 'string' ? body.fulfillmentDate : undefined
    const comment = typeof body.comment === 'string' ? body.comment : ''
    const language = typeof body.language === 'string' ? body.language : 'hu'
    const sendEmail = Boolean(body.sendEmail)

    let invoiceTypeRaw = typeof body.invoiceType === 'string' ? body.invoiceType : 'normal'
    if (invoiceTypeRaw !== 'normal' && invoiceTypeRaw !== 'advance' && invoiceTypeRaw !== 'proforma') {
      invoiceTypeRaw = 'normal'
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .is('deleted_at', null)
      .single()

    if (orderError || !order) {
      return { ok: false, error: 'Rendelés nem található', status: 404 }
    }

    const customerEmailFromBody =
      typeof body.customerEmail === 'string' ? String(body.customerEmail).trim() : ''
    const customerEmailResolved =
      customerEmailFromBody || String((order as { customer_email?: string | null }).customer_email ?? '').trim()

    if (sendEmail && !customerEmailResolved) {
      return {
        ok: false,
        error:
          'E-mail küldéshez kötelező a vevő e-mail címe. Adja meg a rendelésen vagy az űrlapon, majd mentse a rendelést, ha szükséges.',
        status: 400
      }
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items')
      .select(
        'id, product_name, quantity, unit_price_net, unit_price_gross, tax_rate, line_total_net, line_total_gross'
      )
      .eq('order_id', orderId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (itemsError) {
      return { ok: false, error: itemsError.message, status: 500 }
    }

    const baseItems = itemsData ?? []

    const { data: orderFeesData, error: orderFeesError } = await supabase
      .from('order_fees')
      .select('id, type, name, quantity, unit_net, unit_gross, vat_rate, line_net, line_gross')
      .eq('order_id', orderId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (orderFeesError) {
      return { ok: false, error: orderFeesError.message, status: 500 }
    }

    const feeItems = (orderFeesData || [])
      .filter((f) => String(f.type || '').toUpperCase() !== 'SHIPPING')
      .map((f) => ({
        id: String(f.id),
        product_name: String(f.name || 'Díj'),
        quantity: Number(f.quantity) || 1,
        unit_price_net: Number(f.unit_net) || 0,
        unit_price_gross: Number(f.unit_gross) || 0,
        tax_rate: Number(f.vat_rate) || 0,
        line_total_net: Number(f.line_net) || 0,
        line_total_gross: Number(f.line_gross) || 0
      }))

    const items = [...baseItems, ...feeItems]
    if (items.length === 0) {
      return { ok: false, error: 'A rendeléshez nincs tétel — nem állítható ki számla.', status: 400 }
    }

    const { data: vatRates, error: vatError } = await supabase.from('vat').select('id, kulcs').is('deleted_at', null)

    if (vatError) {
      return { ok: false, error: 'Hiba az ÁFA kulcsok lekérdezése során', status: 500 }
    }

    const vatRatesMap = new Map<string, number>()
    vatRates?.forEach((v) => vatRatesMap.set(v.id, Number(v.kulcs)))

    const { data: payments } = await supabase
      .from('order_payments')
      .select('amount')
      .eq('order_id', orderId)
      .is('deleted_at', null)

    let isAdvanceInvoiceRequest = invoiceTypeRaw === 'advance'
    let isProformaInvoiceRequest = invoiceTypeRaw === 'proforma'

    let hasPartialProforma = false
    if (isAdvanceInvoiceRequest || isProformaInvoiceRequest || invoiceTypeRaw === 'normal') {
      const { data: proformaCheck } = await supabase
        .from('invoices')
        .select('gross_total')
        .eq('related_order_type', RELATED_ORDER_TYPE)
        .eq('related_order_id', orderId)
        .eq('invoice_type', 'dijbekero')
        .eq('provider', PROVIDER)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (proformaCheck?.gross_total != null) {
        const proformaTotal = Number(proformaCheck.gross_total)
        const orderTotal = calculateShopOrderTotalGross(order as Record<string, unknown>, items as Record<string, unknown>[])
        hasPartialProforma = proformaTotal < orderTotal
      }
    }

    const isDeferredPaymentOrder = Boolean((order as { payment_method_after?: boolean | null }).payment_method_after)
    if (!isAdvanceInvoiceRequest && !isProformaInvoiceRequest && !hasPartialProforma && !isDeferredPaymentOrder) {
      const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0)
      const totalDue = calculateShopOrderTotalGross(order as Record<string, unknown>, items as Record<string, unknown>[])
      if (totalDue - totalPaid > 1) {
        return { ok: false, error: 'Csak teljesen kifizetett rendeléshez hozható létre számla', status: 400 }
      }
    }

    if (isAdvanceInvoiceRequest && (!body.advanceAmount || Number(body.advanceAmount) <= 0)) {
      return { ok: false, error: 'Előleg számla esetén az előleg összegének megadása kötelező', status: 400 }
    }

    let existingAdvanceInvoice: { provider_invoice_number: string; gross_total: number } | null = null
    let existingProformaInvoice: { provider_invoice_number: string } | null = null
    let proformaInvoiceData: { id: string; provider_invoice_number: string | null } | null = null

    const isNormalInvoiceRequest =
      invoiceTypeRaw === 'normal' || (invoiceTypeRaw !== 'advance' && invoiceTypeRaw !== 'proforma')

    if (isNormalInvoiceRequest && !isAdvanceInvoiceRequest && !isProformaInvoiceRequest) {
      const { data: advanceInvoiceCheck } = await supabase
        .from('invoices')
        .select('id')
        .eq('related_order_type', RELATED_ORDER_TYPE)
        .eq('related_order_id', orderId)
        .eq('invoice_type', 'elolegszamla')
        .eq('provider', PROVIDER)
        .limit(1)
        .maybeSingle()

      if (advanceInvoiceCheck) {
        const { data: existingFinalInvoice } = await supabase
          .from('invoices')
          .select('id, is_storno_of_invoice_id')
          .eq('related_order_type', RELATED_ORDER_TYPE)
          .eq('related_order_id', orderId)
          .eq('invoice_type', 'szamla')
          .eq('provider', PROVIDER)
          .is('is_storno_of_invoice_id', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (existingFinalInvoice) {
          const { data: stornoInvoice } = await supabase
            .from('invoices')
            .select('id')
            .eq('related_order_type', RELATED_ORDER_TYPE)
            .eq('related_order_id', orderId)
            .eq('invoice_type', 'sztorno')
            .eq('is_storno_of_invoice_id', existingFinalInvoice.id)
            .eq('provider', PROVIDER)
            .limit(1)
            .maybeSingle()

          if (!stornoInvoice) {
            return {
              ok: false,
              error:
                'Már létezik végszámla ehhez a rendeléshez. Kérjük, először sztornózza a végszámlát, ha új számlát szeretne létrehozni.',
              status: 400
            }
          }
        }
      }

      const { data: advanceInvoiceData } = await supabase
        .from('invoices')
        .select('id, provider_invoice_number, gross_total')
        .eq('related_order_type', RELATED_ORDER_TYPE)
        .eq('related_order_id', orderId)
        .eq('invoice_type', 'elolegszamla')
        .eq('provider', PROVIDER)
        .is('is_storno_of_invoice_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (advanceInvoiceData) {
        const { data: stornoCheck } = await supabase
          .from('invoices')
          .select('id')
          .eq('related_order_type', RELATED_ORDER_TYPE)
          .eq('related_order_id', orderId)
          .eq('invoice_type', 'sztorno')
          .eq('is_storno_of_invoice_id', advanceInvoiceData.id)
          .eq('provider', PROVIDER)
          .limit(1)
          .maybeSingle()

        if (!stornoCheck) {
          existingAdvanceInvoice = {
            provider_invoice_number: advanceInvoiceData.provider_invoice_number || '',
            gross_total: Number(advanceInvoiceData.gross_total || 0)
          }
        }
      }

      if (!existingAdvanceInvoice) {
        const { data: plainSzamla } = await supabase
          .from('invoices')
          .select('id')
          .eq('related_order_type', RELATED_ORDER_TYPE)
          .eq('related_order_id', orderId)
          .eq('invoice_type', 'szamla')
          .eq('provider', PROVIDER)
          .is('is_storno_of_invoice_id', null)
          .maybeSingle()

        if (plainSzamla) {
          const { data: stornoOfFinal } = await supabase
            .from('invoices')
            .select('id')
            .eq('related_order_type', RELATED_ORDER_TYPE)
            .eq('related_order_id', orderId)
            .eq('invoice_type', 'sztorno')
            .eq('is_storno_of_invoice_id', plainSzamla.id)
            .eq('provider', PROVIDER)
            .limit(1)
            .maybeSingle()

          if (!stornoOfFinal) {
            return {
              ok: false,
              error:
                'Ehhez a rendeléshez már létezik számla. További számlához használjon stornót vagy más típust.',
              status: 409
            }
          }
        }
      }
    }

    if (isAdvanceInvoiceRequest || (!isAdvanceInvoiceRequest && !isProformaInvoiceRequest)) {
      const { data: proformaData } = await supabase
        .from('invoices')
        .select('id, provider_invoice_number, gross_total')
        .eq('related_order_type', RELATED_ORDER_TYPE)
        .eq('related_order_id', orderId)
        .eq('invoice_type', 'dijbekero')
        .eq('provider', PROVIDER)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (proformaData) {
        proformaInvoiceData = proformaData
        existingProformaInvoice = {
          provider_invoice_number: proformaData.provider_invoice_number || ''
        }

        if (
          !isAdvanceInvoiceRequest &&
          !isProformaInvoiceRequest &&
          !existingAdvanceInvoice &&
          proformaData.gross_total != null
        ) {
          const proformaGrossTotal = Number(proformaData.gross_total)
          const orderTotal = calculateShopOrderTotalGross(order as Record<string, unknown>, items as Record<string, unknown>[])
          if (proformaGrossTotal < orderTotal) {
            invoiceTypeRaw = 'advance'
            body.advanceAmount = proformaGrossTotal
            isAdvanceInvoiceRequest = true
            isProformaInvoiceRequest = false
          }
        }
      }
    }

    let connection = null as Awaited<ReturnType<typeof getSzamlazzConnectionForOrder>>
    if (options?.forcedSzamlazzConnectionId) {
      connection = await getSzamlazzConnectionById(supabase, options.forcedSzamlazzConnectionId)
    } else {
      connection = await getSzamlazzConnectionForOrder(supabase, order)
    }

    if (!connection?.password) {
      return {
        ok: false,
        error:
          'Nincs aktív Számlázz kapcsolat (Agent kulcs). Adjon hozzá egyet a Kapcsolatok oldalon.',
        status: 400
      }
    }

    const tenantCompany = null as { email?: string | null } | null

    const settings: ShopInvoiceXmlSettings = {
      invoiceType: invoiceTypeRaw as ShopInvoiceXmlSettings['invoiceType'],
      paymentMethod: mapBodyPaymentMethod(body.paymentMethod as string | undefined, order.payment_method_code),
      dueDate,
      fulfillmentDate,
      comment,
      language,
      sendEmail,
      advanceAmount: body.advanceAmount,
      proformaAmount: body.proformaAmount
    }

    const agentKey = String(connection.password).trim()
    const orderForXml = {
      ...(order as Record<string, unknown>),
      customer_email: customerEmailResolved || (order as { customer_email?: string | null }).customer_email
    }

    const xmlRequest = buildShopFinalInvoiceXml(
      agentKey,
      orderForXml,
      items as Record<string, unknown>[],
      tenantCompany,
      vatRatesMap,
      settings,
      existingAdvanceInvoice,
      existingProformaInvoice
    )

    const apiUrl = normalizeSzamlazzApiUrl(connection.api_url)
    const formData = new FormData()
    const xmlBlob = new Blob([xmlRequest], { type: 'application/xml; charset=utf-8' })
    formData.append('action-xmlagentxmlfile', xmlBlob, 'invoice.xml')

    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(120000)
    })

    const contentType = response.headers.get('content-type') || ''
    const isPdf = contentType.includes('application/pdf') || contentType.includes('pdf')
    const errorCode = response.headers.get('szlahu_error_code')
    const errorMessage = response.headers.get('szlahu_error')
    const invoiceNumberHeader = response.headers.get('szlahu_szamlaszam')

    let responseText = ''
    if (isPdf) {
      await response.arrayBuffer()
    } else {
      responseText = await response.text()
    }

    if (errorCode || errorMessage) {
      return {
        ok: false,
        error: `Szamlazz.hu hiba${errorCode ? ` (${errorCode})` : ''}: ${errorMessage || 'Ismeretlen hiba'}`,
        status: 400,
        details: responseText.substring(0, 500)
      }
    }

    if (!isPdf && responseText && (responseText.includes('<hibakod>') || responseText.includes('<hibauzenet>'))) {
      const errorCodeMatch = responseText.match(/<hibakod>([^<]+)<\/hibakod>/i)
      const errorMessageMatch = responseText.match(/<hibauzenet>([^<]+)<\/hibauzenet>/i)
      return {
        ok: false,
        error: `Szamlazz.hu XML hiba${errorCodeMatch ? ` (${errorCodeMatch[1]})` : ''}: ${errorMessageMatch ? errorMessageMatch[1] : 'Ismeretlen'}`,
        status: 400,
        details: responseText.substring(0, 500)
      }
    }

    let finalInvoiceNumber = invoiceNumberHeader
    if (!finalInvoiceNumber && !isPdf && responseText) {
      const m = responseText.match(/<szamlaszam>([^<]+)<\/szamlaszam>/i)
      finalInvoiceNumber = m ? m[1] : null
    }

    if (!finalInvoiceNumber) {
      return {
        ok: false,
        error: 'Számla szám nem található a válaszban',
        status: 400,
        details: responseText.substring(0, 800)
      }
    }

    const customerName = shopOrderBillingName(order as Record<string, unknown>)

    let invoiceGrossTotal: number | null = null
    if (isAdvanceInvoiceRequest && body.advanceAmount) {
      invoiceGrossTotal = Number(body.advanceAmount)
    } else if (isProformaInvoiceRequest && body.proformaAmount && Number(body.proformaAmount) > 0) {
      invoiceGrossTotal = Number(body.proformaAmount)
    } else if (existingAdvanceInvoice) {
      const calculatedOrderTotal = calculateShopOrderTotalGross(
        order as Record<string, unknown>,
        items as Record<string, unknown>[]
      )
      invoiceGrossTotal = calculatedOrderTotal - existingAdvanceInvoice.gross_total
    } else {
      invoiceGrossTotal = calculateShopOrderTotalGross(
        order as Record<string, unknown>,
        items as Record<string, unknown>[]
      )
    }

    const invoiceRow: Record<string, unknown> = {
      provider: PROVIDER,
      provider_invoice_number: finalInvoiceNumber,
      provider_invoice_id: finalInvoiceNumber,
      invoice_type: isAdvanceInvoiceRequest ? 'elolegszamla' : isProformaInvoiceRequest ? 'dijbekero' : 'szamla',
      related_order_type: RELATED_ORDER_TYPE,
      related_order_id: orderId,
      related_order_number: (order as { order_number?: string }).order_number,
      customer_name: customerName,
      customer_id: null,
      payment_due_date: dueDate,
      fulfillment_date: fulfillmentDate || dueDate,
      gross_total: invoiceGrossTotal,
      payment_status: isProformaInvoiceRequest ? 'pending' : 'fizetve',
      is_storno_of_invoice_id: null,
      pdf_url: null,
      connection_id: connection.id
    }

    const { data: insertData, error: insertError } = await supabase.from('invoices').insert(invoiceRow).select().single()

    if (insertError) {
      console.error('invoice insert error:', insertError, invoiceRow)
      return {
        ok: false,
        error: 'Számla létrejött a Számlázz.hu-n, de nem sikerült menteni az ERP-be',
        status: 500,
        details: insertError.message
      }
    }

    if (!isAdvanceInvoiceRequest && !isProformaInvoiceRequest && existingProformaInvoice && proformaInvoiceData?.id) {
      await supabase
        .from('invoices')
        .update({ payment_status: 'fizetve' })
        .eq('id', proformaInvoiceData.id)
    }

    return {
      ok: true,
      invoiceNumber: finalInvoiceNumber,
      invoice: insertData
    }
  } catch (e) {
    console.error('createShopInvoiceInternal', e)
    return { ok: false, error: e instanceof Error ? e.message : 'Belső hiba', status: 500 }
  }
}
