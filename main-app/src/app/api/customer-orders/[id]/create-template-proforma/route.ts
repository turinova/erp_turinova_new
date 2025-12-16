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
  advanceAmount?: number // Advance invoice amount (gross)
  proformaAmount?: number // Proforma invoice amount (gross), if partial
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
  settings: CreateTemplateProformaRequest,
  existingAdvanceInvoice?: { provider_invoice_number: string; gross_total: number } | null,
  existingProformaInvoice?: { provider_invoice_number: string; gross_total: number } | null
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
  
  // Use original order number when referencing an advance invoice, so Számlázz.hu can match it
  // Számlázz.hu validates advance invoice references by matching both invoice number and order number
  // Otherwise, use a unique template order number with timestamp to avoid duplicates
  // This ensures each regeneration creates a new unique template
  const hasValidAdvanceInvoice = existingAdvanceInvoice && existingAdvanceInvoice.provider_invoice_number && existingAdvanceInvoice.provider_invoice_number.trim()
  const orderNumber = hasValidAdvanceInvoice 
    ? order.order_number 
    : `${order.order_number}-TEMPLATE-${Date.now()}`

  // Check if this is an advance invoice or proforma with amount
  const isAdvanceInvoice = settings.invoiceType === 'advance'
  // Improved type conversion: handle undefined, null, and invalid values properly
  // Convert proformaAmount to number, handling string, number, null, undefined
  let proformaAmountNum = 0
  if (settings.proformaAmount != null && settings.proformaAmount !== '') {
    // Handle both string and number types
    const parsed = typeof settings.proformaAmount === 'string' 
      ? parseFloat(settings.proformaAmount.replace(/[^\d.-]/g, '')) 
      : Number(settings.proformaAmount)
    if (!isNaN(parsed) && parsed > 0 && isFinite(parsed)) {
      proformaAmountNum = parsed
    }
  }
  
  // Check if proforma with amount - must be proforma type AND have amount > 0
  // IMPORTANT: For partial proforma, we want to show only 1 "Előleg" item like advance invoice
  const isProformaWithAmount = settings.invoiceType === 'proforma' && proformaAmountNum > 0
  
  console.log('buildTemplateProformaXml - Amount check:', {
    invoiceType: settings.invoiceType,
    proformaAmount: settings.proformaAmount,
    proformaAmountNum,
    isProformaWithAmount,
    willUseSingleItem: isProformaWithAmount
  })
  const advanceAmount = typeof settings.advanceAmount === 'string'
    ? parseFloat(settings.advanceAmount.replace(/[^\d.-]/g, '')) || 0
    : Number(settings.advanceAmount) || 0
  const proformaAmount = proformaAmountNum
  
  console.log('buildTemplateProformaXml - Invoice type check:', {
    invoiceType: settings.invoiceType,
    proformaAmountFromSettings: settings.proformaAmount,
    proformaAmountNum,
    isProformaWithAmount,
    isAdvanceInvoice,
    advanceAmount
  })

  // Build items XML
  // IMPORTANT: szamlazz.hu validates that afaErtek = nettoErtek × afakulcs / 100 (exactly)
  // We use stored nettoErtek from database, but recalculate afaErtek to ensure validation passes
  // Then bruttoErtek = nettoErtek + afaErtek
  let itemsXml = ''
  
  if (isAdvanceInvoice && advanceAmount > 0) {
    // For advance invoice, create single item with advance amount
    // Use default VAT rate (27% or highest from items)
    let advanceVatRate = 27 // Default to 27% (most common in Hungary)
    if (items.length > 0) {
      // Find highest VAT rate from items
      const rates = items.map(item => vatRatesMap.get(item.vat_id) || 0)
      advanceVatRate = Math.max(...rates, 27)
    }
    
    // GROSS-based rounding (B2C) - user enters gross amount, we calculate VAT and net
    // Round gross to integer first (per Számlázz.hu: "Round the gross, round the VAT, then net = gross - VAT")
    const advanceBrutto = Math.round(advanceAmount) // Round gross to integer
    // Calculate VAT from gross: VAT = gross / (100 + VAT_rate) × VAT_rate
    const advanceVatPrecise = advanceBrutto / (100 + advanceVatRate) * advanceVatRate
    const advanceVat = Math.round(advanceVatPrecise) // Round VAT to integer
    // Calculate net: net = gross - VAT (both integers, result is integer)
    const advanceNet = advanceBrutto - advanceVat
    
    itemsXml = `
      <tetel>
        <megnevezes>Előleg</megnevezes>
        <mennyiseg>1</mennyiseg>
        <mennyisegiEgyseg>db</mennyisegiEgyseg>
        <nettoEgysegar>${advanceNet}</nettoEgysegar>
        <afakulcs>${advanceVatRate}</afakulcs>
        <nettoErtek>${advanceNet}</nettoErtek>
        <afaErtek>${advanceVat}</afaErtek>
        <bruttoErtek>${advanceBrutto}</bruttoErtek>
      </tetel>`
  } else if (isProformaWithAmount) {
    // For proforma invoice with partial amount, create single item with proforma amount
    console.log('Creating proforma with amount:', {
      proformaAmount,
      proformaAmountNum,
      invoiceType: settings.invoiceType,
      isProformaWithAmount,
      proformaAmountFromSettings: settings.proformaAmount
    })
    // Use default VAT rate (27% or highest from items)
    let proformaVatRate = 27 // Default to 27% (most common in Hungary)
    if (items.length > 0) {
      // Find highest VAT rate from items
      const rates = items.map(item => vatRatesMap.get(item.vat_id) || 0)
      proformaVatRate = Math.max(...rates, 27)
    }
    
    // GROSS-based rounding (B2C) - user enters gross amount, we calculate VAT and net
    // Round gross to integer first (per Számlázz.hu: "Round the gross, round the VAT, then net = gross - VAT")
    const proformaBrutto = Math.round(proformaAmount) // Round gross to integer
    // Calculate VAT from gross: VAT = gross / (100 + VAT_rate) × VAT_rate
    const proformaVatPrecise = proformaBrutto / (100 + proformaVatRate) * proformaVatRate
    const proformaVat = Math.round(proformaVatPrecise) // Round VAT to integer
    // Calculate net: net = gross - VAT (both integers, result is integer)
    const proformaNet = proformaBrutto - proformaVat
    
    console.log('Proforma calculation:', { proformaAmount, proformaVatRate, proformaNet, proformaVat, proformaBrutto })
    
    itemsXml = `
      <tetel>
        <megnevezes>Előleg</megnevezes>
        <mennyiseg>1</mennyiseg>
        <mennyisegiEgyseg>db</mennyisegiEgyseg>
        <nettoEgysegar>${proformaNet}</nettoEgysegar>
        <afakulcs>${proformaVatRate}</afakulcs>
        <nettoErtek>${proformaNet}</nettoErtek>
        <afaErtek>${proformaVat}</afaErtek>
        <bruttoErtek>${proformaBrutto}</bruttoErtek>
      </tetel>`
  } else {
    // Normal invoice or full proforma - use existing items
    console.log('Using full items for invoice. invoiceType:', settings.invoiceType, 'proformaAmount:', settings.proformaAmount, 'isProformaWithAmount:', isProformaWithAmount, 'proformaAmountNum:', proformaAmountNum)
    itemsXml = items.map((item) => {
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
  }

  // Add advance deduction item if there's an existing advance invoice (for final invoice preview)
  // Don't add for advance invoices, proforma invoices, or proforma with amount
  let advanceDeductionXml = ''
  const isNormalInvoiceForFinal = settings.invoiceType === 'normal' && !isAdvanceInvoice && !isProformaWithAmount
  if (existingAdvanceInvoice && isNormalInvoiceForFinal) {
    const advanceGross = existingAdvanceInvoice.gross_total
    // Use the same VAT rate calculation as advance invoice (27% or highest from items)
    let advanceVatRate = 27
    if (items.length > 0) {
      const rates = items.map(item => vatRatesMap.get(item.vat_id) || 0)
      advanceVatRate = Math.max(...rates, 27)
    }
    
    // GROSS-based rounding (B2C) - advanceGross is from existing advance invoice
    // Round gross to integer first (per Számlázz.hu: "Round the gross, round the VAT, then net = gross - VAT")
    const advanceBrutto = Math.round(advanceGross) // Round gross to integer
    // Calculate VAT from gross: VAT = gross / (100 + VAT_rate) × VAT_rate
    const advanceVatPrecise = advanceBrutto / (100 + advanceVatRate) * advanceVatRate
    const advanceVat = Math.round(advanceVatPrecise) // Round VAT to integer
    // Calculate net: net = gross - VAT (both integers, result is integer)
    const advanceNet = advanceBrutto - advanceVat
    
    // Add negative item for advance already invoiced
    advanceDeductionXml = `
      <tetel>
        <megnevezes>Előleg a termék vásárlásra (${escapeXml(existingAdvanceInvoice.provider_invoice_number)} alapján)</megnevezes>
        <mennyiseg>1</mennyiseg>
        <mennyisegiEgyseg>db</mennyisegiEgyseg>
        <nettoEgysegar>${-advanceNet}</nettoEgysegar>
        <afakulcs>${advanceVatRate}</afakulcs>
        <nettoErtek>${-advanceNet}</nettoErtek>
        <afaErtek>${-advanceVat}</afaErtek>
        <bruttoErtek>${-advanceBrutto}</bruttoErtek>
      </tetel>`
  }

  // Add discount item if discount exists (only for normal invoices, not advance or proforma with amount)
  let discountXml = ''
  const discountAmount = Number(order.discount_amount) || 0
  if (isNormalInvoiceForFinal && discountAmount > 0) {
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
    <megjegyzes>${escapeXml(settings.comment || '')}</megjegyzes>
    <arfolyamBank>MNB</arfolyamBank>
    <arfolyam>1</arfolyam>
    <rendelesSzam>${escapeXml(orderNumber)}</rendelesSzam>
    ${settings.invoiceType === 'proforma' ? '<dijbekero>true</dijbekero>' : ''}
    ${existingProformaInvoice && (isAdvanceInvoice || (settings.invoiceType === 'normal' && !existingAdvanceInvoice && !isAdvanceInvoice)) ? `<dijbekeroSzamlaszam>${escapeXml(existingProformaInvoice.provider_invoice_number)}</dijbekeroSzamlaszam>` : ''}
    ${isAdvanceInvoice ? '<elolegszamla>true</elolegszamla>' : ''}
    ${existingAdvanceInvoice && isNormalInvoiceForFinal ? '<vegszamla>true</vegszamla>' : ''}
    ${existingAdvanceInvoice && isNormalInvoiceForFinal ? `<elolegSzamlaszam>${escapeXml(existingAdvanceInvoice.provider_invoice_number)}</elolegSzamlaszam>` : ''}
    <elonezetpdf>true</elonezetpdf>
  </fejlec>
  <elado>
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
    ${order.billing_tax_number && order.billing_tax_number.trim() 
      ? `<adoszam>${escapeXml(order.billing_tax_number)}</adoszam>` 
      : '<adoalany>-1</adoalany>'}
  </vevo>
  <tetelek>
    ${itemsXml}
    ${advanceDeductionXml}
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
    
    console.log('Create template proforma - Received request:', {
      invoiceType: body.invoiceType,
      proformaAmount: body.proformaAmount,
      proformaAmountType: typeof body.proformaAmount,
      advanceAmount: body.advanceAmount,
      advanceAmountType: typeof body.advanceAmount
    })

    // Fetch customer order
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from('customer_orders')
      .select('*')
      .eq('id', id)
      .single()

    if (orderError || !orderData) {
      return NextResponse.json(
        { error: 'Ügyfél rendelés nem található' },
        { status: 404 }
      )
    }

    // Fetch order items
    const { data: itemsData, error: itemsError } = await supabaseAdmin
      .from('customer_order_items')
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
      .eq('order_id', id)
      .is('deleted_at', null)

    if (itemsError) {
      console.error('Error fetching customer order items:', itemsError)
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

    // Check if there's an existing advance invoice for this order (for final invoice preview)
    let isAdvanceInvoiceRequest = body.invoiceType === 'advance'
    const isProformaInvoiceRequest = body.invoiceType === 'proforma'
    let existingAdvanceInvoice: { provider_invoice_number: string; gross_total: number } | null = null
    let existingProformaInvoice: { provider_invoice_number: string; gross_total: number } | null = null
    
    // Check for existing végszámla (final invoice) before proceeding
    // This prevents the error "A hivatkozott előlegszámla nem beazonosítható"
    if (!isAdvanceInvoiceRequest && !isProformaInvoiceRequest) {
      // First check if there's an advance invoice
      const { data: advanceInvoiceCheck, error: advanceCheckError } = await supabaseAdmin
        .from('invoices')
        .select('id')
        .eq('related_order_type', 'customer_order')
        .eq('related_order_id', id)
        .eq('invoice_type', 'elolegszamla')
        .eq('provider', 'szamlazz_hu')
        .limit(1)
        .maybeSingle()
      
      // If there's an advance invoice, check if there's already a végszámla
      if (!advanceCheckError && advanceInvoiceCheck) {
        const { data: existingFinalInvoice, error: finalInvoiceError } = await supabaseAdmin
          .from('invoices')
          .select('id, is_storno_of_invoice_id')
          .eq('related_order_type', 'customer_order')
          .eq('related_order_id', id)
          .eq('invoice_type', 'szamla')
          .eq('provider', 'szamlazz_hu')
          .is('is_storno_of_invoice_id', null) // Not stornoed
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        
        if (!finalInvoiceError && existingFinalInvoice) {
          // Check if this final invoice has been stornoed
          const { data: stornoInvoice, error: stornoError } = await supabaseAdmin
            .from('invoices')
            .select('id')
            .eq('related_order_type', 'customer_order')
            .eq('related_order_id', id)
            .eq('invoice_type', 'sztorno')
            .eq('is_storno_of_invoice_id', existingFinalInvoice.id)
            .eq('provider', 'szamlazz_hu')
            .limit(1)
            .maybeSingle()
          
          // If there's a final invoice that hasn't been stornoed, return error
          if (!stornoError && !stornoInvoice) {
            return NextResponse.json(
              { error: 'Már létezik végszámla ehhez a rendeléshez. Kérjük, először sztornózza a végszámlát, ha új számlát szeretne létrehozni.' },
              { status: 400 }
            )
          }
        }
      }
    }
    
    // Always check for proforma invoice (needed for advance invoice preview or normal invoice preview)
    const { data: proformaInvoiceData, error: proformaError } = await supabaseAdmin
      .from('invoices')
      .select('provider_invoice_number, gross_total')
      .eq('related_order_type', 'customer_order')
      .eq('related_order_id', id)
      .eq('invoice_type', 'dijbekero')
      .eq('provider', 'szamlazz_hu')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    if (!proformaError && proformaInvoiceData) {
      existingProformaInvoice = {
        provider_invoice_number: proformaInvoiceData.provider_invoice_number || '',
        gross_total: Number(proformaInvoiceData.gross_total || 0)
      }
      console.log('Template proforma: Found existing proforma invoice:', existingProformaInvoice)
    }
    
    // Check for advance invoice (needed for final invoice preview)
    // This must happen BEFORE partial proforma conversion, because if there's an advance invoice,
    // we want to create a final invoice preview, not convert to advance based on partial proforma
    // IMPORTANT: Exclude stornoed advance invoices - if an advance invoice was stornoed,
    // we should treat it as if no advance invoice exists (Hungarian invoicing rules)
    if (!isAdvanceInvoiceRequest && !isProformaInvoiceRequest) {
      const { data: advanceInvoiceData, error: advanceError } = await supabaseAdmin
        .from('invoices')
        .select('id, provider_invoice_number, gross_total')
        .eq('related_order_type', 'customer_order')
        .eq('related_order_id', id)
        .eq('invoice_type', 'elolegszamla')
        .eq('provider', 'szamlazz_hu')
        .is('is_storno_of_invoice_id', null) // Exclude stornoed advance invoices
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (!advanceError && advanceInvoiceData) {
        // Double-check if this advance invoice has been stornoed
        const { data: stornoCheck, error: stornoCheckError } = await supabaseAdmin
          .from('invoices')
          .select('id')
          .eq('related_order_type', 'customer_order')
          .eq('related_order_id', id)
          .eq('invoice_type', 'sztorno')
          .eq('is_storno_of_invoice_id', advanceInvoiceData.id)
          .eq('provider', 'szamlazz_hu')
          .limit(1)
          .maybeSingle()
        
        // Only use advance invoice if it hasn't been stornoed
        if (!stornoCheckError && !stornoCheck) {
          existingAdvanceInvoice = {
            provider_invoice_number: advanceInvoiceData.provider_invoice_number || '',
            gross_total: Number(advanceInvoiceData.gross_total || 0)
          }
          console.log('Template proforma: Found existing advance invoice for final invoice preview:', existingAdvanceInvoice)
        } else {
          console.log('Template proforma: Advance invoice found but it has been stornoed, treating as no advance invoice')
          existingAdvanceInvoice = null
        }
      }
    }
    
    // If creating normal invoice and there's a partial proforma, AND NO existing advance invoice,
    // treat it as advance invoice preview
    // IMPORTANT: Only convert to advance if there's NO existing advance invoice
    // If there's an advance invoice, we want to create a final invoice preview instead
    if (!isAdvanceInvoiceRequest && !isProformaInvoiceRequest && !existingAdvanceInvoice && existingProformaInvoice) {
      const proformaGrossTotal = existingProformaInvoice.gross_total
      const orderTotal = Number(orderData.total_gross || 0)
      
      // If proforma has partial amount, show advance invoice preview
      if (proformaGrossTotal < orderTotal) {
        console.log('Template proforma: Partial proforma detected (no advance invoice), converting to advance invoice preview')
        body.invoiceType = 'advance'
        body.advanceAmount = proformaGrossTotal
        isAdvanceInvoiceRequest = true
      }
    }

    // Validate that supplier and buyer tax numbers are different (only if both are provided)
    // Note: Individual customers may not have tax numbers, so this check is optional
    const supplierTaxNumber = tenantCompany.tax_number?.trim().replace(/\s+/g, '') || ''
    const buyerTaxNumber = orderData.billing_tax_number?.trim().replace(/\s+/g, '') || ''
    
    // Only validate if both tax numbers are provided and they are the same
    if (supplierTaxNumber && buyerTaxNumber && supplierTaxNumber === buyerTaxNumber) {
      return NextResponse.json(
        { 
          error: 'A szállító és a vevő adószáma nem lehet ugyanaz. Kérjük, ellenőrizze a számlázási adatokat.',
        },
        { status: 400 }
      )
    }

    // Build XML request
    console.log('Building template proforma XML with settings:', {
      invoiceType: body.invoiceType,
      originalInvoiceType: body.invoiceType,
      proformaAmount: body.proformaAmount,
      advanceAmount: body.advanceAmount,
      isAdvanceInvoiceRequest,
      isProformaInvoiceRequest,
      existingAdvanceInvoice: existingAdvanceInvoice ? { number: existingAdvanceInvoice.provider_invoice_number, total: existingAdvanceInvoice.gross_total } : null,
      existingProformaInvoice: existingProformaInvoice ? { number: existingProformaInvoice.provider_invoice_number, total: existingProformaInvoice.gross_total } : null,
      willCreateFinalInvoice: !!existingAdvanceInvoice && body.invoiceType === 'normal' && !isAdvanceInvoiceRequest && !isProformaInvoiceRequest
    })
    const xmlRequest = buildTemplateProformaXml(
      orderData,
      itemsData || [],
      tenantCompany,
      vatRatesMap,
      body,
      existingAdvanceInvoice,
      existingProformaInvoice
    )
    console.log('Generated XML length:', xmlRequest.length)
    console.log('XML contains vegszamla:', xmlRequest.includes('vegszamla'))
    console.log('XML contains elolegSzamlaszam:', xmlRequest.includes('elolegSzamlaszam'))
    console.log('XML contains advance deduction:', xmlRequest.includes('Előleg a termék vásárlásra'))
    
    // Log a snippet of the XML to verify structure (especially for partial proforma or final invoice)
    if ((body.invoiceType === 'proforma' && body.proformaAmount) || (existingAdvanceInvoice && body.invoiceType === 'normal')) {
      const tetelekMatch = xmlRequest.match(/<tetelek>([\s\S]*?)<\/tetelek>/)
      if (tetelekMatch) {
        console.log('Preview XML - Tetelek section:', tetelekMatch[1].substring(0, 500))
      }
      const fejlecMatch = xmlRequest.match(/<fejlec>([\s\S]*?)<\/fejlec>/)
      if (fejlecMatch) {
        console.log('Preview XML - Fejlec section:', fejlecMatch[1].substring(0, 500))
      }
    }

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
    
    // Check content type - with elonezetpdf, response can be PDF or XML with base64 PDF
    const contentType = response.headers.get('content-type') || ''
    const isPdf = contentType.includes('application/pdf') || contentType.includes('pdf')
    
    // Helper function to get value from parsed XML
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
    
    // Handle PDF response (direct PDF from elonezetpdf)
    if (isPdf) {
      try {
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const base64 = buffer.toString('base64')
        
        console.log('Template proforma - PDF received directly from elonezetpdf, size:', buffer.length, 'bytes')
        
        return NextResponse.json({
          success: true,
          pdf: base64,
          mimeType: 'application/pdf',
          invoiceNumber: null, // No invoice number for preview (elonezetpdf doesn't create invoice)
          proformaInvoiceNumber: existingProformaInvoice?.provider_invoice_number || null,
          advanceInvoiceNumber: existingAdvanceInvoice?.provider_invoice_number || null,
          message: 'Előnézet PDF sikeresen létrehozva'
        })
      } catch (err) {
        console.error('Template proforma - Error reading PDF response:', err)
        return NextResponse.json(
          { error: 'Hiba a PDF válasz feldolgozása során' },
          { status: 500 }
        )
      }
    }
    
    // Handle XML response (may contain base64 PDF with valaszVerzio=2)
    if (parsedResponse) {
      // Check for PDF in XML (valaszVerzio=2 returns PDF as base64 in XML)
      const pdfBase64 = getValue(parsedResponse, [
        'xmlszamlavalasz.pdf',
        'xmlszamlavalasz.pdfTartalom',
        'pdf',
        'pdfTartalom'
      ])
      
      if (pdfBase64) {
        console.log('Template proforma - PDF found in XML response')
        return NextResponse.json({
          success: true,
          pdf: pdfBase64,
          mimeType: 'application/pdf',
          invoiceNumber: null, // No invoice number for preview
          proformaInvoiceNumber: existingProformaInvoice?.provider_invoice_number || null,
          advanceInvoiceNumber: existingAdvanceInvoice?.provider_invoice_number || null,
          message: 'Előnézet PDF sikeresen létrehozva'
        })
      }
    }
    
    // Fallback: Check for PDF in response text using regex
    if (responseText) {
      const pdfMatch = responseText.match(/<pdf[^>]*>([^<]+)<\/pdf>/i) || 
                       responseText.match(/<pdfTartalom[^>]*>([^<]+)<\/pdfTartalom>/i)
      if (pdfMatch && pdfMatch[1]) {
        console.log('Template proforma - PDF found in response text')
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
    }
    
    // If no PDF found, return error
    return NextResponse.json(
      { 
        error: 'Előnézet PDF nem található a válaszban',
        details: responseText.substring(0, 500)
      },
      { status: 500 }
    )

  } catch (error: any) {
    console.error('Error creating template proforma invoice:', error)
    return NextResponse.json(
      { error: error.message || 'Belső szerver hiba történt' },
      { status: 500 }
    )
  }
}

