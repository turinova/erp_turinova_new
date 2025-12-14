import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// FormData and Blob are available in Node.js 18+
// For Next.js, we can use them directly in API routes

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Számlázz.hu API credentials
const SZAMLAZZ_AGENT_KEY = process.env.SZAMLAZZ_AGENT_KEY || 'zatx49i6i2jgw3yj4a9bkmtrzcwditxceyifacy257'
const SZAMLAZZ_API_URL = process.env.SZAMLAZZ_API_URL || 'https://www.szamlazz.hu/szamla/'

interface InvoiceRequest {
  invoiceType: string
  paymentMethod: string
  dueDate: string
  fulfillmentDate?: string // Optional fulfillment date
  comment: string
  language: string
  sendEmail: boolean
  preview?: boolean // If true, use temporary order number for preview
}

// Helper function to escape XML
function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return ''
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Build XML request for szamlazz.hu
function buildInvoiceXml(
  order: any,
  items: any[],
  tenantCompany: any,
  vatRatesMap: Map<string, number>,
  settings: InvoiceRequest
): string {
  // Map payment method
  const paymentMethodMap: Record<string, string> = {
    cash: 'készpénz',
    bank_transfer: 'átutalás',
    card: 'bankkártya'
  }
  const paymentMethod = paymentMethodMap[settings.paymentMethod] || 'készpénz'

  // Map invoice type
  const invoiceTypeMap: Record<string, string> = {
    normal: 'NORMAL',
    simplified: 'SIMPLIFIED',
    proforma: 'PROFORMA'
  }
  const invoiceType = invoiceTypeMap[settings.invoiceType] || 'NORMAL'

  // Format date (YYYY-MM-DD)
  const invoiceDate = new Date().toISOString().split('T')[0]
  const dueDate = settings.dueDate || new Date().toISOString().split('T')[0]
  const fulfillmentDate = settings.fulfillmentDate || invoiceDate
  
  // Use temporary order number for preview to avoid duplicate invoice errors
  const orderNumber = settings.preview 
    ? `${order.pos_order_number}-PREVIEW-${Date.now()}`
    : order.pos_order_number

  // Build items XML
  // IMPORTANT: szamlazz.hu validates calculations EXACTLY:
  // 1. nettoErtek = mennyiseg × nettoEgysegar (MUST match exactly)
  // 2. afaErtek = nettoErtek × afakulcs / 100 (MUST match exactly)
  // 3. bruttoErtek = nettoErtek + afaErtek (MUST match exactly)
  // We MUST recalculate from unit price and quantity, not use stored totals
  const itemsXml = items.map((item) => {
    const vatRate = vatRatesMap.get(item.vat_id) || 0
    const mennyiseg = Number(item.quantity)
    const nettoEgysegar = Number(item.unit_price_net)
    
    // Calculate nettoErtek = quantity × unit price (exactly as API expects)
    const nettoErtek = mennyiseg * nettoEgysegar
    
    // Calculate afaErtek = nettoErtek × vatRate / 100 (exactly as API expects)
    const afaErtek = (nettoErtek * vatRate) / 100
    
    // Calculate bruttoErtek = nettoErtek + afaErtek (exactly as API expects)
    const bruttoErtek = nettoErtek + afaErtek
    
    return `
      <tetel>
        <megnevezes>${escapeXml(item.product_name)}</megnevezes>
        <mennyiseg>${mennyiseg}</mennyiseg>
        <mennyisegiEgyseg>${item.product_type === 'material' ? 'm²' : item.product_type === 'linear_material' ? 'm' : 'db'}</mennyisegiEgyseg>
        <nettoEgysegar>${nettoEgysegar}</nettoEgysegar>
        <afakulcs>${vatRate}</afakulcs>
        <nettoErtek>${nettoErtek}</nettoErtek>
        <afaErtek>${afaErtek}</afaErtek>
        <bruttoErtek>${bruttoErtek}</bruttoErtek>
      </tetel>`
  }).join('')

  // Build XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamla https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(SZAMLAZZ_AGENT_KEY)}</szamlaagentkulcs>
    <eszamla>${settings.invoiceType === 'simplified' ? 'true' : 'false'}</eszamla>
    <szamlaLetoltes>true</szamlaLetoltes>
    <valaszVerzio>2</valaszVerzio>
    <aggregator></aggregator>
  </beallitasok>
  <fejlec>
    <keltDatum>${invoiceDate}</keltDatum>
    <teljesitesDatum>${fulfillmentDate}</teljesitesDatum>
    <fizetesiHataridoDatum>${dueDate}</fizetesiHataridoDatum>
    <fizmod>${paymentMethod}</fizmod>
    <penznem>Ft</penznem>
    <szamlaNyelve>${settings.language.toLowerCase()}</szamlaNyelve>
    <megjegyzes>${escapeXml(settings.comment || `Rendelés: ${order.pos_order_number}`)}</megjegyzes>
    <arfolyamBank>MNB</arfolyamBank>
    <arfolyam>1</arfolyam>
    <rendelesSzam>${escapeXml(orderNumber)}</rendelesSzam>
    ${settings.invoiceType === 'proforma' ? '<dijbekero>true</dijbekero>' : ''}
  </fejlec>
  <elado>
    <bank>${escapeXml(tenantCompany?.name || '')}</bank>
    ${tenantCompany?.email ? `<emailReplyto>${escapeXml(tenantCompany.email)}</emailReplyto>` : ''}
    <emailTargy>${escapeXml(`Számla - ${orderNumber}`)}</emailTargy>
    <emailSzoveg>${escapeXml('Tisztelettel küldjük számláját.')}</emailSzoveg>
  </elado>
  <vevo>
    <nev>${escapeXml(order.billing_name || order.customer_name || '')}</nev>
    <irsz>${escapeXml(order.billing_postal_code || '')}</irsz>
    <telepules>${escapeXml(order.billing_city || '')}</telepules>
    <cim>${escapeXml(order.billing_street && order.billing_house_number ? `${order.billing_street} ${order.billing_house_number}` : '')}</cim>
    <email>${escapeXml(order.customer_email || '')}</email>
    <sendEmail>${settings.sendEmail && order.customer_email ? 'true' : 'false'}</sendEmail>
    <adoszam>${escapeXml(order.billing_tax_number || '')}</adoszam>
  </vevo>
  <tetelek>
    ${itemsXml}
  </tetelek>
</xmlszamla>`

  return xml
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body: InvoiceRequest = await request.json()

    // Fetch POS order
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from('pos_orders')
      .select('*')
      .eq('id', id)
      .single()

    if (orderError || !orderData) {
      return NextResponse.json(
        { error: 'POS rendelés nem található' },
        { status: 404 }
      )
    }

    // Fetch order items
    const { data: itemsData, error: itemsError } = await supabaseAdmin
      .from('pos_order_items')
      .select(`
        id,
        item_type,
        product_type,
        accessory_id,
        material_id,
        linear_material_id,
        feetype_id,
        product_name,
        sku,
        quantity,
        unit_price_net,
        unit_price_gross,
        vat_id,
        currency_id,
        total_net,
        total_vat,
        total_gross
      `)
      .eq('pos_order_id', id)
      .is('deleted_at', null)

    if (itemsError) {
      console.error('Error fetching POS order items:', itemsError)
      return NextResponse.json(
        { error: `Hiba a tételek lekérdezése során: ${itemsError.message}` },
        { status: 500 }
      )
    }

    // Fetch tenant company
    const { data: tenantCompany, error: companyError } = await supabaseAdmin
      .from('tenant_company')
      .select('*')
      .is('deleted_at', null)
      .limit(1)
      .single()

    if (companyError || !tenantCompany) {
      return NextResponse.json(
        { error: 'Céginformációk nem találhatók' },
        { status: 500 }
      )
    }

    // Fetch VAT rates
    const { data: vatRates, error: vatError } = await supabaseAdmin
      .from('vat')
      .select('id, kulcs')

    if (vatError) {
      return NextResponse.json(
        { error: 'Hiba az ÁFA kulcsok lekérdezése során' },
        { status: 500 }
      )
    }

    // Create VAT rates map
    const vatRatesMap = new Map<string, number>()
    vatRates?.forEach(vat => {
      vatRatesMap.set(vat.id, vat.kulcs)
    })

    // Build XML request
    const xmlRequest = buildInvoiceXml(
      orderData,
      itemsData || [],
      tenantCompany,
      vatRatesMap,
      body
    )

    // Send request to szamlazz.hu as multipart/form-data with XML file
    // According to documentation: https://docs.szamlazz.hu/agent/generating_invoice/request
    // Must be multipart/form-data with file field named "action-xmlagentxmlfile"
    const apiUrl = SZAMLAZZ_API_URL // Already includes trailing slash: https://www.szamlazz.hu/szamla/
    
    // Create FormData with XML as a file
    const formData = new FormData()
    const xmlBlob = new Blob([xmlRequest], { type: 'application/xml; charset=utf-8' })
    formData.append('action-xmlagentxmlfile', xmlBlob, 'invoice.xml')
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData
      // Don't set Content-Type header - browser will set it automatically with boundary for multipart/form-data
    })

    // Check content type - can be XML or PDF
    const contentType = response.headers.get('content-type') || ''
    const isPdf = contentType.includes('application/pdf') || contentType.includes('pdf')
    
    // Szamlazz.hu returns errors in response headers even with HTTP 200
    const errorCode = response.headers.get('szlahu_error_code')
    const errorMessage = response.headers.get('szlahu_error')
    const invoiceNumber = response.headers.get('szlahu_szamlaszam')

    // Log full response headers for debugging
    const allHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      allHeaders[key] = value
    })
    console.log('Szamlazz.hu Response Headers:', allHeaders)
    
    // Read response as text (we can handle both XML and PDF preview this way)
    const responseText = await response.text()
    
    if (isPdf) {
      console.log('Szamlazz.hu Response: PDF file received (size:', responseText.length, 'bytes)')
    } else {
      console.log('Szamlazz.hu Response Body:', responseText.substring(0, 1000))
    }

    // Check for errors in headers
    if (errorCode || errorMessage) {
      console.error('Szamlazz.hu API error:', {
        code: errorCode,
        message: errorMessage,
        response: responseText.substring(0, 500)
      })
      return NextResponse.json(
        { 
          error: `Szamlazz.hu hiba${errorCode ? ` (${errorCode})` : ''}: ${errorMessage || 'Ismeretlen hiba'}`,
          details: responseText.substring(0, 500)
        },
        { status: 400 }
      )
    }

    // Also check response body for errors (only if not PDF - PDF means success)
    if (!isPdf && responseText && (responseText.includes('<hibakod>') || responseText.includes('<hibauzenet>'))) {
      const errorCodeMatch = responseText.match(/<hibakod>([^<]+)<\/hibakod>/i)
      const errorMessageMatch = responseText.match(/<hibauzenet>([^<]+)<\/hibauzenet>/i)
      
      if (errorCodeMatch || errorMessageMatch) {
        console.error('Szamlazz.hu XML error:', {
          code: errorCodeMatch ? errorCodeMatch[1] : null,
          message: errorMessageMatch ? errorMessageMatch[1] : null
        })
        return NextResponse.json(
          { 
            error: `Szamlazz.hu XML hiba${errorCodeMatch ? ` (${errorCodeMatch[1]})` : ''}: ${errorMessageMatch ? errorMessageMatch[1] : 'Ismeretlen hiba'}`,
            details: responseText.substring(0, 500)
          },
          { status: 400 }
        )
      }
    }

    // Parse invoice number from headers or XML response
    // If PDF was returned, invoice number should be in headers
    // If XML was returned, check both headers and XML body
    let finalInvoiceNumber = invoiceNumber
    if (!finalInvoiceNumber && !isPdf && responseText) {
      const invoiceNumberMatch = responseText.match(/<szamlaszam>([^<]+)<\/szamlaszam>/i)
      finalInvoiceNumber = invoiceNumberMatch ? invoiceNumberMatch[1] : null
    }
    
    // PDF response typically means success - invoice number should be in headers
    if (isPdf && !finalInvoiceNumber) {
      console.warn('PDF received but no invoice number in headers')
    }

    if (!finalInvoiceNumber) {
      // Try to extract error message from response
      let errorMsg = 'Számla szám nem található a válaszban'
      const errorMatch = !isPdf && responseText ? responseText.match(/<hibauzenet>([^<]+)<\/hibauzenet>/i) : null
      const errorCodeMatch = !isPdf && responseText ? responseText.match(/<hibakod>([^<]+)<\/hibakod>/i) : null
      
      if (errorCodeMatch) {
        const errorCode = errorCodeMatch[1]
        errorMsg = `Szamlazz.hu hiba (kód: ${errorCode})`
        if (errorMatch) {
          errorMsg += `: ${errorMatch[1]}`
        } else {
          // Map common error codes to messages
          const errorCodeMap: Record<string, string> = {
            '57': 'XML beolvasási hiba - ellenőrizze az XML formátumot',
            '259': 'Tétel nettó értéke nem megfelelő',
            '260': 'Tétel áfa értéke nem megfelelő',
            '261': 'Tétel bruttó értéke nem megfelelő',
            '3': 'Bejelentkezési hiba - ellenőrizze az Agent Key-t',
            '202': 'Számlaszám előtag nem megfelelő'
          }
          errorMsg += errorCodeMap[errorCode] || ''
        }
      } else if (errorMatch) {
        errorMsg = errorMatch[1]
      }
      
      console.error('No invoice number in response. Full response:', responseText)
      return NextResponse.json(
        { 
          error: errorMsg,
          details: responseText.substring(0, 1000),
          responseHeaders: {
            errorCode: errorCode,
            errorMessage: errorMessage
          }
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      invoiceNumber: finalInvoiceNumber,
      message: 'Számla sikeresen létrehozva'
    })

  } catch (error: any) {
    console.error('Error creating invoice:', error)
    return NextResponse.json(
      { error: error.message || 'Belső szerver hiba történt' },
      { status: 500 }
    )
  }
}
