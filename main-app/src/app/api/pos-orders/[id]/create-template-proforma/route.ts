import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { XMLParser } from 'fast-xml-parser'

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

// Configure XML parser for response parsing
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: false,
  trimValues: true,
  parseTrueNumberOnly: false,
  arrayMode: false,
  ignoreNameSpace: false,
  removeNSPrefix: false,
  parseNodeValue: true
})

interface CreateTemplateProformaRequest {
  invoiceType: string
  paymentMethod: string
  dueDate: string
  fulfillmentDate?: string
  comment: string
  language: string
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

// Build XML request for creating template proforma invoice
function buildTemplateProformaXml(
  order: any,
  items: any[],
  tenantCompany: any,
  vatRatesMap: Map<string, number>,
  settings: CreateTemplateProformaRequest
): string {
  // Map payment method
  const paymentMethodMap: Record<string, string> = {
    cash: 'készpénz',
    bank_transfer: 'átutalás',
    card: 'bankkártya'
  }
  const paymentMethod = paymentMethodMap[settings.paymentMethod] || 'készpénz'

  // Format date (YYYY-MM-DD)
  const invoiceDate = new Date().toISOString().split('T')[0]
  const dueDate = settings.dueDate || new Date().toISOString().split('T')[0]
  const fulfillmentDate = settings.fulfillmentDate || invoiceDate
  
  // Use a unique template order number with timestamp to avoid duplicates
  // This ensures each regeneration creates a new unique template
  const orderNumber = `${order.pos_order_number}-TEMPLATE-${Date.now()}`

  // Build items XML
  // IMPORTANT: szamlazz.hu validates that afaErtek = nettoErtek × afakulcs / 100 (exactly)
  // We use stored nettoErtek from database, but recalculate afaErtek to ensure validation passes
  // Then bruttoErtek = nettoErtek + afaErtek
  const itemsXml = items.map((item) => {
    const vatRate = vatRatesMap.get(item.vat_id) || 0
    const mennyiseg = Number(item.quantity)
    
    // Use stored net value from database (already rounded)
    const nettoErtek = Math.round(Number(item.total_net || 0))
    
    // Recalculate VAT from net value to ensure szamlazz.hu validation passes
    // afaErtek = nettoErtek × afakulcs / 100 (must match exactly)
    const afaErtek = Math.round(nettoErtek * vatRate / 100)
    
    // Calculate gross = net + VAT (ensures consistency)
    const bruttoErtek = nettoErtek + afaErtek
    
    // Calculate unit price from stored totals for display (backwards calculation)
    const nettoEgysegar = mennyiseg > 0 ? Math.round(nettoErtek / mennyiseg) : 0
    
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
  let discountXml = ''
  const discountAmount = Number(order.discount_amount) || 0
  if (discountAmount > 0) {
    // Find the most appropriate VAT rate from items (use the one with highest gross total)
    // This ensures we use a standard VAT rate that szamlazz.hu accepts
    let discountVatRate = 27 // Default to 27% (most common in Hungary)
    if (items.length > 0) {
      // Group items by VAT rate and calculate total gross for each
      // Use stored total_gross values to match page calculation exactly
      const vatTotals = new Map<number, number>()
      items.forEach((item) => {
        const vatRate = vatRatesMap.get(item.vat_id) || 0
        // Use stored total_gross (already rounded) instead of recalculating
        const itemGross = Math.round(Number(item.total_gross || 0))
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
    // Round discount amount to integer to match page calculation
    const roundedDiscountAmount = Math.round(discountAmount)
    // Since discount is applied to gross, we need to calculate net: gross / (1 + vat_rate/100)
    // Round to integers to match item calculation rounding
    const discountNetPrecise = roundedDiscountAmount / (1 + discountVatRate / 100)
    const discountNet = Math.round(discountNetPrecise)
    // Calculate VAT and round to integer, then adjust discount amount to ensure consistency
    const discountVat = roundedDiscountAmount - discountNet
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

  // Build XML - Always use proforma for template
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamla https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(SZAMLAZZ_AGENT_KEY)}</szamlaagentkulcs>
    <eszamla>false</eszamla>
    <szamlaLetoltes>false</szamlaLetoltes>
    <valaszVerzio>1</valaszVerzio>
    <aggregator></aggregator>
  </beallitasok>
  <fejlec>
    <keltDatum>${invoiceDate}</keltDatum>
    <teljesitesDatum>${fulfillmentDate}</teljesitesDatum>
    <fizetesiHataridoDatum>${dueDate}</fizetesiHataridoDatum>
    <fizmod>${paymentMethod}</fizmod>
    <penznem>Ft</penznem>
    <szamlaNyelve>${settings.language.toLowerCase()}</szamlaNyelve>
    <megjegyzes>${escapeXml(settings.comment || `Rendelés: ${order.pos_order_number} - ELŐNÉZET`)}</megjegyzes>
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
    const body: CreateTemplateProformaRequest = await request.json()

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

    // Validate that supplier and buyer tax numbers are different
    // Szamlazz.hu doesn't allow the same tax number for supplier and buyer
    const supplierTaxNumber = tenantCompany.tax_number?.trim().replace(/\s+/g, '') || ''
    const buyerTaxNumber = orderData.billing_tax_number?.trim().replace(/\s+/g, '') || ''
    
    if (supplierTaxNumber && buyerTaxNumber && supplierTaxNumber === buyerTaxNumber) {
      return NextResponse.json(
        { 
          error: 'A szállító és a vevő adószáma nem lehet ugyanaz. Kérjük, ellenőrizze a számlázási adatokat.',
        },
        { status: 400 }
      )
    }

    // Build XML request
    const xmlRequest = buildTemplateProformaXml(
      orderData,
      itemsData || [],
      tenantCompany,
      vatRatesMap,
      body
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

    // Check for errors in headers
    const errorCode = response.headers.get('szlahu_error_code')
    let errorMessage = response.headers.get('szlahu_error')
    const invoiceNumber = response.headers.get('szlahu_szamlaszam')

    // Decode URL-encoded error message
    if (errorMessage) {
      try {
        errorMessage = decodeURIComponent(errorMessage.replace(/\+/g, ' '))
      } catch (e) {
        // If decoding fails, use original message
        console.warn('Failed to decode error message:', e)
      }
    }

    // Read response
    const responseText = await response.text()
    
    // Parse XML response for better error handling
    let parsedResponse: any = null
    let xmlErrorCode: string | null = null
    let xmlErrorMessage: string | null = null
    
    if (responseText) {
      try {
        parsedResponse = xmlParser.parse(responseText)
        
        // Extract error information from parsed XML
        // Check various possible error structures
        const getValue = (obj: any, paths: string[]): string | null => {
          for (const path of paths) {
            const keys = path.split('.')
            let current: any = obj
            for (const key of keys) {
              if (current && typeof current === 'object' && key in current) {
                current = current[key]
              } else {
                current = null
                break
              }
            }
            if (current && typeof current === 'string') {
              return current.trim()
            }
            if (current && typeof current === 'object' && '#text' in current) {
              return String(current['#text'] || '').trim()
            }
          }
          return null
        }
        
        xmlErrorCode = getValue(parsedResponse, [
          'xmlszamlavalasz.hibakod',
          'hibakod',
          'error.code',
          'result.errorCode'
        ]) || null
        
        xmlErrorMessage = getValue(parsedResponse, [
          'xmlszamlavalasz.hibauzenet',
          'hibauzenet',
          'error.message',
          'result.errorMessage',
          'result.message'
        ]) || null
        
        // Also check for error in result/functionCode
        const funcCode = getValue(parsedResponse, [
          'xmlszamlavalasz.eredmeny.funkcio',
          'eredmeny.funkcio',
          'result.funcCode',
          'funcCode'
        ])
        
        if (funcCode === 'ERROR' || funcCode === 'HIBA') {
          // If funcCode is ERROR, there's definitely an error
          if (!xmlErrorCode) xmlErrorCode = errorCode || 'UNKNOWN'
          if (!xmlErrorMessage) xmlErrorMessage = errorMessage || 'Ismeretlen hiba'
        }
      } catch (parseError) {
        console.warn('Failed to parse XML response, using regex fallback:', parseError)
        // Fallback to regex parsing
        if (responseText.includes('<hibakod>') || responseText.includes('<hibauzenet>')) {
          const errorCodeMatch = responseText.match(/<hibakod[^>]*>([^<]+)<\/hibakod>/i)
          const errorMessageMatch = responseText.match(/<hibauzenet[^>]*>([^<]+)<\/hibauzenet>/i)
          
          if (errorCodeMatch) xmlErrorCode = errorCodeMatch[1].trim()
          if (errorMessageMatch) xmlErrorMessage = errorMessageMatch[1].trim()
        }
      }
    }

    // Use XML error if available, otherwise use header error
    const finalErrorCode = xmlErrorCode || errorCode
    const finalErrorMessage = xmlErrorMessage || errorMessage

    if (finalErrorCode || finalErrorMessage) {
      console.error('Create Template Proforma - Szamlazz.hu API error:', {
        code: finalErrorCode,
        message: finalErrorMessage,
        headerError: errorMessage,
        xmlError: xmlErrorMessage
      })
      return NextResponse.json(
        { 
          error: `Szamlazz.hu hiba${finalErrorCode ? ` (${finalErrorCode})` : ''}: ${finalErrorMessage || 'Ismeretlen hiba'}`,
        },
        { status: 400 }
      )
    }
    
    // Parse invoice number from headers or XML
    let finalInvoiceNumber = invoiceNumber
    if (!finalInvoiceNumber && parsedResponse) {
      const invoiceNum = parsedResponse.xmlszamlavalasz?.szamlaszam || 
                        parsedResponse.szamlaszam ||
                        null
      if (invoiceNum) {
        finalInvoiceNumber = typeof invoiceNum === 'string' ? invoiceNum : invoiceNum['#text'] || null
      }
    }
    
    // Fallback to regex if XML parsing didn't find it
    if (!finalInvoiceNumber && responseText) {
      const invoiceNumberMatch = responseText.match(/<szamlaszam[^>]*>([^<]+)<\/szamlaszam>/i)
      finalInvoiceNumber = invoiceNumberMatch ? invoiceNumberMatch[1].trim() : null
    }

    if (!finalInvoiceNumber) {
      return NextResponse.json(
        { error: 'Számlaszám nem található a válaszban' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      invoiceNumber: finalInvoiceNumber,
      message: 'Template proforma számla sikeresen létrehozva'
    })

  } catch (error: any) {
    console.error('Error creating template proforma invoice:', error)
    return NextResponse.json(
      { error: error.message || 'Belső szerver hiba történt' },
      { status: 500 }
    )
  }
}


