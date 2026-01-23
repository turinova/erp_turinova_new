import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

interface InvoicePreviewRequest {
  invoiceType: string
  paymentMethod: string
  dueDate: string
  fulfillmentDate?: string
  comment: string
  language: string
  sendEmail: boolean
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

// Build XML request for szamlazz.hu (shared with create-invoice)
function buildInvoiceXml(
  order: any,
  items: any[],
  tenantCompany: any,
  vatRatesMap: Map<string, number>,
  settings: InvoicePreviewRequest & { preview: boolean }
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
  
  // Use temporary order number for preview
  const orderNumber = `${order.pos_order_number}-PREVIEW-${Date.now()}`

  // Build items XML
  // IMPORTANT: Use stored total_net, total_vat, total_gross which already have per-item discounts applied
  // Számlázz.hu requirement: nettoErtek = mennyiseg × nettoEgysegar (must match exactly)
  const itemsXml = items.map((item) => {
    const vatRate = vatRatesMap.get(item.vat_id) || 0
    const mennyiseg = Number(item.quantity)
    
    // Use stored totals which already have per-item discounts applied
    const nettoErtek = Math.round(Number(item.total_net) || 0)
    const afaErtek = Math.round(Number(item.total_vat) || 0)
    const bruttoErtek = Math.round(Number(item.total_gross) || 0)
    
    // Calculate unit price exactly (no rounding) to ensure nettoErtek = mennyiseg × nettoEgysegar
    // szamlazz.hu accepts decimal unit prices and validates: nettoErtek = mennyiseg × nettoEgysegar
    const nettoEgysegar = mennyiseg > 0 ? nettoErtek / mennyiseg : 0
    
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

  // Add discount item if discount exists
  // The discount_amount is applied to gross total, so we need to split it into net and VAT
  let discountXml = ''
  const discountAmount = Number(order.discount_amount) || 0
  if (discountAmount > 0) {
    // Calculate the gross total before discount from items (matches frontend calculation)
    // This ensures the discount XML uses the same base as the frontend display
    let grossBeforeDiscount = 0
    items.forEach(item => {
      const gross = Math.round(Number(item.total_gross || 0))
      grossBeforeDiscount += gross
    })
    
    // Find the most appropriate VAT rate from items (use the one with highest gross total)
    // This ensures we use a standard VAT rate that szamlazz.hu accepts
    let discountVatRate = 27 // Default to 27% (most common in Hungary)
    if (items.length > 0) {
      // Group items by VAT rate and calculate total gross for each
      const vatTotals = new Map<number, number>()
      items.forEach((item) => {
        const vatRate = vatRatesMap.get(item.vat_id) || 0
        // Use stored total_gross which already has per-item discounts applied
        const itemGross = Math.round(Number(item.total_gross) || 0)
        const currentTotal = vatTotals.get(vatRate) || 0
        vatTotals.set(vatRate, currentTotal + itemGross)
      })
      
      // Find the VAT rate with the highest total gross
      let maxGross = 0
      vatTotals.forEach((gross, rate) => {
        if (gross > maxGross) {
          maxGross = gross
          discountVatRate = rate
        }
      })
    }
    
    // Calculate discount amounts using the selected VAT rate
    // Round discount amount to integer first (matches create-invoice API)
    const roundedDiscountAmount = Math.round(discountAmount)
    // Since discount is applied to gross, we need to calculate net: gross / (1 + vat_rate/100)
    // Round to integers (whole forints) for Számlázz.hu compliance
    const discountNetPrecise = roundedDiscountAmount / (1 + discountVatRate / 100)
    const discountNet = Math.round(discountNetPrecise) // Round to integer
    const discountVat = roundedDiscountAmount - discountNet // Ensure exact total (discountNet + discountVat = roundedDiscountAmount)
    const discountBrutto = -roundedDiscountAmount // Negative for discount
    
    // Build discount item name
    const discountName = order.discount_percentage && order.discount_percentage > 0
      ? `Kedvezmény (${order.discount_percentage}%)`
      : 'Kedvezmény'
    
    discountXml = `
      <tetel>
        <megnevezes>${escapeXml(discountName)}</megnevezes>
        <mennyiseg>1</mennyiseg>
        <mennyisegiEgyseg>db</mennyisegiEgyseg>
        <nettoEgysegar>${-discountNet}</nettoEgysegar>
        <afakulcs>${discountVatRate}</afakulcs>
        <nettoErtek>${-discountNet}</nettoErtek>
        <afaErtek>${-discountVat}</afaErtek>
        <bruttoErtek>${discountBrutto}</bruttoErtek>
      </tetel>`
  }

  // Build XML - Always use proforma for previews so they can be deleted
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamla https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(SZAMLAZZ_AGENT_KEY)}</szamlaagentkulcs>
    <eszamla>false</eszamla>
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
    <megjegyzes>${escapeXml(settings.comment || `Rendelés: ${order.pos_order_number} - PREVIEW`)}</megjegyzes>
    <arfolyamBank>MNB</arfolyamBank>
    <arfolyam>1</arfolyam>
    <rendelesSzam>${escapeXml(orderNumber)}</rendelesSzam>
    <dijbekero>true</dijbekero>
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
    <sendEmail>false</sendEmail>
    <adoszam>${escapeXml(order.billing_tax_number || '')}</adoszam>
  </vevo>
  <tetelek>
    ${itemsXml}
    ${discountXml}
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
    const body: InvoicePreviewRequest = await request.json()

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
        total_gross,
        discount_percentage,
        discount_amount
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

    // Build XML request with preview flag
    const xmlRequest = buildInvoiceXml(
      orderData,
      itemsData || [],
      tenantCompany,
      vatRatesMap,
      { ...body, preview: true }
    )

    // Send request to szamlazz.hu
    const apiUrl = SZAMLAZZ_API_URL
    const formData = new FormData()
    const xmlBlob = new Blob([xmlRequest], { type: 'application/xml; charset=utf-8' })
    formData.append('action-xmlagentxmlfile', xmlBlob, 'invoice.xml')
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData
    })

    // Check content type
    const contentType = response.headers.get('content-type') || ''
    const isPdf = contentType.includes('application/pdf') || contentType.includes('pdf')
    
    // Check for errors in headers first (before reading body)
    const errorCode = response.headers.get('szlahu_error_code')
    const errorMessage = response.headers.get('szlahu_error')

    // Log headers for debugging
    const allHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      allHeaders[key] = value
    })
    console.log('Preview - Szamlazz.hu Response Headers:', allHeaders)

    if (errorCode || errorMessage) {
      console.error('Preview - Szamlazz.hu API error in headers:', {
        code: errorCode,
        message: errorMessage
      })
      return NextResponse.json(
        { 
          error: `Szamlazz.hu hiba${errorCode ? ` (${errorCode})` : ''}: ${errorMessage || 'Ismeretlen hiba'}`,
        },
        { status: 400 }
      )
    }

    // Handle PDF response
    if (isPdf) {
      try {
        // For PDF, read as array buffer and convert to base64
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const base64 = buffer.toString('base64')
        
        console.log('Preview - PDF received, size:', buffer.length, 'bytes')
        
        // Extract invoice number from headers
        const invoiceNumber = response.headers.get('szlahu_szamlaszam')
        
        return NextResponse.json({
          success: true,
          pdf: base64,
          mimeType: 'application/pdf',
          invoiceNumber: invoiceNumber || null
        })
      } catch (err) {
        console.error('Preview - Error reading PDF response:', err)
        return NextResponse.json(
          { error: 'Hiba a PDF válasz feldolgozása során' },
          { status: 500 }
        )
      }
    }

    // Handle XML/text response
    try {
      const responseText = await response.text()
      console.log('Preview - Non-PDF response received, content-type:', contentType)
      console.log('Preview - Response preview:', responseText.substring(0, 500))
      
      // Check if response contains PDF data in base64 within XML (some API versions)
      const pdfMatch = responseText.match(/<pdf>([^<]+)<\/pdf>/i) || 
                       responseText.match(/<pdfTartalom>([^<]+)<\/pdfTartalom>/i) ||
                       responseText.match(/<pdf_base64>([^<]+)<\/pdf_base64>/i)
      if (pdfMatch && pdfMatch[1]) {
        console.log('Preview - Found PDF in XML response')
        // Try to extract invoice number from XML
        const invoiceNumberMatch = responseText.match(/<szamlaszam>([^<]+)<\/szamlaszam>/i)
        return NextResponse.json({
          success: true,
          pdf: pdfMatch[1],
          mimeType: 'application/pdf',
          invoiceNumber: invoiceNumberMatch ? invoiceNumberMatch[1] : null
        })
      }
      
      // Check response body for errors
      if (responseText && (responseText.includes('<hibakod>') || responseText.includes('<hibauzenet>'))) {
        const errorCodeMatch = responseText.match(/<hibakod>([^<]+)<\/hibakod>/i)
        const errorMessageMatch = responseText.match(/<hibauzenet>([^<]+)<\/hibauzenet>/i)
        
        if (errorCodeMatch || errorMessageMatch) {
          console.error('Preview - Szamlazz.hu XML error:', {
            code: errorCodeMatch ? errorCodeMatch[1] : null,
            message: errorMessageMatch ? errorMessageMatch[1] : null
          })
          return NextResponse.json(
            { 
              error: `Szamlazz.hu XML hiba${errorCodeMatch ? ` (${errorCodeMatch[1]})` : ''}: ${errorMessageMatch ? errorMessageMatch[1] : 'Ismeretlen hiba'}`,
            },
            { status: 400 }
          )
        }
      }
      
      // If we get here, it's an unexpected format
      console.warn('Preview - Unexpected response format:', {
        contentType,
        responseLength: responseText.length,
        hasXmlError: responseText.includes('<hibakod>') || responseText.includes('<hibauzenet>'),
        responsePreview: responseText.substring(0, 500)
      })
      
      return NextResponse.json(
        { 
          error: `Váratlan válasz formátum (${contentType || 'ismeretlen'}). Ellenőrizze a konzol üzeneteket.`,
          details: responseText.substring(0, 500)
        },
        { status: 500 }
      )
    } catch (err: any) {
      console.error('Preview - Error reading response:', err)
      return NextResponse.json(
        { error: `Hiba a válasz feldolgozása során: ${err.message}` },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('Error previewing invoice:', error)
    return NextResponse.json(
      { error: error.message || 'Belső szerver hiba történt' },
      { status: 500 }
    )
  }
}

