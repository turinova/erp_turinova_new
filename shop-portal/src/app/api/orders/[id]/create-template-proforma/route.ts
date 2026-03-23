import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { normalizeSzamlazzApiUrl } from '@/lib/szamlazz-agent'
import { getSzamlazzConnectionForOrder } from '@/lib/shop-szamlazz-connection'
import {
  buildShopTemplatePreviewXml,
  calculateShopOrderTotalGross,
  type ShopInvoiceXmlSettings
} from '@/lib/szamlazz-shop-xml'

const RELATED = 'order' as const
const PROVIDER = 'szamlazz_hu'

interface CreateTemplateBody {
  invoiceType: string
  paymentMethod: string
  dueDate: string
  fulfillmentDate?: string
  comment: string
  language: string
  advanceAmount?: number
  proformaAmount?: number
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const supabase = await getTenantSupabase()
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as CreateTemplateBody

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .is('deleted_at', null)
      .single()

    if (orderError || !orderData) {
      return NextResponse.json({ error: 'Rendelés nem található' }, { status: 404 })
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
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    const items = itemsData ?? []
    if (items.length === 0) {
      return NextResponse.json(
        { error: 'A rendeléshez nincs tétel — nem készíthető előnézet.' },
        { status: 400 }
      )
    }

    /** Shop tenants may not have tenant_company table — optional email for elado only */
    const tenantCompany = null as { email?: string | null; tax_number?: string | null } | null

    const { data: vatRates, error: vatError } = await supabase.from('vat').select('id, kulcs').is('deleted_at', null)

    if (vatError) {
      return NextResponse.json({ error: 'Hiba az ÁFA kulcsok lekérdezése során' }, { status: 500 })
    }

    const vatRatesMap = new Map<string, number>()
    vatRates?.forEach((v) => vatRatesMap.set(v.id, Number(v.kulcs)))

    const connection = await getSzamlazzConnectionForOrder(supabase, orderData)
    if (!connection?.password) {
      return NextResponse.json(
        {
          error:
            'Nincs aktív Számlázz kapcsolat (Agent kulcs). Adjon hozzá egyet a Kapcsolatok oldalon.'
        },
        { status: 400 }
      )
    }

    let isAdvanceInvoiceRequest = body.invoiceType === 'advance'
    const isProformaInvoiceRequest = body.invoiceType === 'proforma'
    let existingAdvanceInvoice: { provider_invoice_number: string; gross_total: number } | null = null
    let existingProformaInvoice: { provider_invoice_number: string; gross_total: number } | null = null

    if (!isAdvanceInvoiceRequest && !isProformaInvoiceRequest) {
      const { data: advanceInvoiceCheck } = await supabase
        .from('invoices')
        .select('id')
        .eq('related_order_type', RELATED)
        .eq('related_order_id', orderId)
        .eq('invoice_type', 'elolegszamla')
        .eq('provider', PROVIDER)
        .limit(1)
        .maybeSingle()

      if (advanceInvoiceCheck) {
        const { data: existingFinalInvoice } = await supabase
          .from('invoices')
          .select('id, is_storno_of_invoice_id')
          .eq('related_order_type', RELATED)
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
            .eq('related_order_type', RELATED)
            .eq('related_order_id', orderId)
            .eq('invoice_type', 'sztorno')
            .eq('is_storno_of_invoice_id', existingFinalInvoice.id)
            .eq('provider', PROVIDER)
            .limit(1)
            .maybeSingle()

          if (!stornoInvoice) {
            return NextResponse.json(
              {
                error:
                  'Már létezik végszámla ehhez a rendeléshez. Kérjük, először sztornózza a végszámlát, ha új számlát szeretne létrehozni.'
              },
              { status: 400 }
            )
          }
        }
      }
    }

    const { data: proformaInvoiceData } = await supabase
      .from('invoices')
      .select('provider_invoice_number, gross_total')
      .eq('related_order_type', RELATED)
      .eq('related_order_id', orderId)
      .eq('invoice_type', 'dijbekero')
      .eq('provider', PROVIDER)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (proformaInvoiceData) {
      existingProformaInvoice = {
        provider_invoice_number: proformaInvoiceData.provider_invoice_number || '',
        gross_total: Number(proformaInvoiceData.gross_total || 0)
      }
    }

    if (!isAdvanceInvoiceRequest && !isProformaInvoiceRequest) {
      const { data: advanceInvoiceData } = await supabase
        .from('invoices')
        .select('id, provider_invoice_number, gross_total')
        .eq('related_order_type', RELATED)
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
          .eq('related_order_type', RELATED)
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
    }

    if (!isAdvanceInvoiceRequest && !isProformaInvoiceRequest && !existingAdvanceInvoice && existingProformaInvoice) {
      const proformaGrossTotal = existingProformaInvoice.gross_total
      const orderTotal = calculateShopOrderTotalGross(orderData as Record<string, unknown>, items as Record<string, unknown>[])
      if (proformaGrossTotal < orderTotal) {
        body.invoiceType = 'advance'
        body.advanceAmount = proformaGrossTotal
        isAdvanceInvoiceRequest = true
      }
    }

    const supplierTaxNumber = tenantCompany?.tax_number?.trim().replace(/\s+/g, '') || ''
    const buyerTaxNumber = String(orderData.billing_tax_number ?? '')
      .trim()
      .replace(/\s+/g, '')
    if (supplierTaxNumber && buyerTaxNumber && supplierTaxNumber === buyerTaxNumber) {
      return NextResponse.json(
        {
          error:
            'A szállító és a vevő adószáma nem lehet ugyanaz. Kérjük, ellenőrizze a számlázási adatokat.'
        },
        { status: 400 }
      )
    }

    const hasValidAdvanceInvoice =
      existingAdvanceInvoice &&
      existingAdvanceInvoice.provider_invoice_number &&
      existingAdvanceInvoice.provider_invoice_number.trim()
    const orderNumberForXml = hasValidAdvanceInvoice
      ? String(orderData.order_number ?? '')
      : `${String(orderData.order_number ?? '')}-TEMPLATE-${Date.now()}`

    const settings: ShopInvoiceXmlSettings = {
      invoiceType: body.invoiceType as 'normal' | 'advance' | 'proforma',
      paymentMethod: body.paymentMethod as ShopInvoiceXmlSettings['paymentMethod'],
      dueDate: body.dueDate,
      fulfillmentDate: body.fulfillmentDate,
      comment: body.comment || '',
      language: body.language || 'hu',
      sendEmail: false,
      advanceAmount: body.advanceAmount,
      proformaAmount: body.proformaAmount
    }

    const agentKey = String(connection.password).trim()
    const xmlRequest = buildShopTemplatePreviewXml(
      agentKey,
      orderData as Record<string, unknown>,
      items as Record<string, unknown>[],
      tenantCompany,
      vatRatesMap,
      settings,
      existingAdvanceInvoice,
      existingProformaInvoice,
      orderNumberForXml
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

    let errorMessage = response.headers.get('szlahu_error')
    const errorCode = response.headers.get('szlahu_error_code')
    if (errorMessage) {
      try {
        errorMessage = decodeURIComponent(errorMessage.replace(/\+/g, ' '))
      } catch {
        /* ignore */
      }
    }

    if (errorCode || errorMessage) {
      return NextResponse.json(
        {
          error: `Szamlazz.hu hiba${errorCode ? ` (${errorCode})` : ''}: ${errorMessage || 'Ismeretlen hiba'}`
        },
        { status: 400 }
      )
    }

    const contentType = response.headers.get('content-type') || ''
    const isPdf = contentType.includes('application/pdf') || contentType.includes('pdf')

    if (isPdf) {
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const base64 = buffer.toString('base64')
      return NextResponse.json({
        success: true,
        pdf: base64,
        mimeType: 'application/pdf',
        invoiceNumber: null,
        proformaInvoiceNumber: existingProformaInvoice?.provider_invoice_number || null,
        advanceInvoiceNumber: existingAdvanceInvoice?.provider_invoice_number || null,
        message: 'Előnézet PDF sikeresen létrehozva'
      })
    }

    const responseText = await response.text()

    if (responseText && (responseText.includes('<hibakod>') || responseText.includes('<hibauzenet>'))) {
      const errorCodeMatch = responseText.match(/<hibakod[^>]*>([^<]+)<\/hibakod>/i)
      const errorMessageMatch = responseText.match(/<hibauzenet[^>]*>([^<]+)<\/hibauzenet>/i)
      return NextResponse.json(
        {
          error: `Szamlazz.hu XML hiba${errorCodeMatch ? ` (${errorCodeMatch[1]})` : ''}: ${errorMessageMatch ? errorMessageMatch[1] : 'Ismeretlen'}`
        },
        { status: 400 }
      )
    }

    const pdfMatch =
      responseText.match(/<pdf[^>]*>([^<]+)<\/pdf>/i) ||
      responseText.match(/<pdfTartalom[^>]*>([^<]+)<\/pdfTartalom>/i)
    if (pdfMatch?.[1]) {
      return NextResponse.json({
        success: true,
        pdf: pdfMatch[1].trim(),
        mimeType: 'application/pdf',
        invoiceNumber: null,
        proformaInvoiceNumber: existingProformaInvoice?.provider_invoice_number || null,
        advanceInvoiceNumber: existingAdvanceInvoice?.provider_invoice_number || null,
        message: 'Előnézet PDF sikeresen létrehozva'
      })
    }

    return NextResponse.json(
      {
        error: 'Előnézet PDF nem található a válaszban',
        details: responseText.substring(0, 500)
      },
      { status: 500 }
    )
  } catch (e) {
    console.error('create-template-proforma', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Belső hiba' },
      { status: 500 }
    )
  }
}
