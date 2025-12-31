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

// Build XML request for szamlazz.hu
function buildInvoiceXml(
  order: any,
  items: any[],
  tenantCompany: any,
  vatRatesMap: Map<string, number>,
  settings: InvoiceRequest,
  existingAdvanceInvoice?: { provider_invoice_number: string; gross_total: number } | null,
  existingProformaInvoice?: { provider_invoice_number: string } | null
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

  // Check if this is an advance invoice or proforma with amount
  const isAdvanceInvoice = settings.invoiceType === 'advance'
  // Improved type conversion: handle undefined, null, and invalid values properly
  const proformaAmountNum = settings.proformaAmount != null 
    ? Number(settings.proformaAmount) 
    : 0
  const isProformaWithAmount = settings.invoiceType === 'proforma' && !isNaN(proformaAmountNum) && proformaAmountNum > 0
  const advanceAmount = Number(settings.advanceAmount) || 0
  const proformaAmount = proformaAmountNum

  // Build items XML
  // IMPORTANT: szamlazz.hu validates calculations EXACTLY:
  // 1. nettoErtek = mennyiseg × nettoEgysegar (MUST match exactly)
  // 2. afaErtek = nettoErtek × afakulcs / 100 (MUST match exactly)
  // 3. bruttoErtek = nettoErtek + afaErtek (MUST match exactly)
  // We MUST recalculate from unit price and quantity, not use stored totals
  // Note: This may result in slight differences from UI due to rounding, but it's required for API validation
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
  } else if (isProformaWithAmount && proformaAmount > 0) {
    // For proforma invoice with partial amount, create single item with proforma amount
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
    // IMPORTANT: Use stored total_net, total_vat, total_gross which already have per-item discounts applied
    itemsXml = items.map((item) => {
      const vatRate = vatRatesMap.get(item.vat_id) || 0
      const mennyiseg = Number(item.quantity)
      
      // Use stored totals which already have per-item discounts applied
      const nettoErtek = Math.round(Number(item.total_net) || 0)
      const afaErtek = Math.round(Number(item.total_vat) || 0)
      const bruttoErtek = Math.round(Number(item.total_gross) || 0)
      
      // Calculate unit prices from totals (for display in invoice)
      // nettoEgysegar = total_net / quantity
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

  // Add advance deduction item if there's an existing advance invoice (for final invoice)
  // Don't add for advance invoices or proforma with amount
  let advanceDeductionXml = ''
  const shouldCreateFinalInvoice = existingAdvanceInvoice && !isAdvanceInvoice && !isProformaWithAmount && settings.invoiceType !== 'proforma' && settings.invoiceType !== 'advance'
  console.log('buildInvoiceXml - Final invoice check:', {
    existingAdvanceInvoice: !!existingAdvanceInvoice,
    isAdvanceInvoice,
    isProformaWithAmount,
    invoiceType: settings.invoiceType,
    shouldCreateFinalInvoice
  })
  if (shouldCreateFinalInvoice) {
    console.log('Building advance deduction XML for:', existingAdvanceInvoice)
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
    
    console.log('Advance deduction calculation:', {
      advanceGross,
      advanceVatRate,
      advanceNet,
      advanceVat
    })
    
    // Add negative item for advance already invoiced
    // Format: "Előleg a termék vásárlásra (INVOICE_NUMBER alapján)"
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
    console.log('Advance deduction XML generated:', advanceDeductionXml.substring(0, 200))
  } else {
    console.log('No advance deduction - existingAdvanceInvoice:', existingAdvanceInvoice, 'isAdvanceInvoice:', isAdvanceInvoice)
  }

  // Add discount item if discount exists (only for normal invoices, not advance or proforma with amount)
  // The discount_amount is applied to gross total, so we need to split it into net and VAT
  let discountXml = ''
  const discountAmount = Number(order.discount_amount) || 0
  if (!isAdvanceInvoice && !isProformaWithAmount && discountAmount > 0) {
    // Calculate the gross total before discount
    const grossBeforeDiscount = Number(order.subtotal_net) + Number(order.total_vat)
    
    // Find the most appropriate VAT rate from items (use the one with highest gross total)
    // This ensures we use a standard VAT rate that szamlazz.hu accepts
    let discountVatRate = 27 // Default to 27% (most common in Hungary)
    if (items.length > 0) {
      // Group items by VAT rate and calculate total gross for each
      // Use stored total_gross which already has per-item discounts applied
      const vatTotals = new Map<number, number>()
      items.forEach((item) => {
        const vatRate = vatRatesMap.get(item.vat_id) || 0
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
    // Round discount amount to integer first
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

  // Build XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamla https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(SZAMLAZZ_AGENT_KEY)}</szamlaagentkulcs>
    <eszamla>${settings.invoiceType === 'simplified' || settings.invoiceType === 'normal' ? 'true' : 'false'}</eszamla>
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
    ${existingProformaInvoice && settings.invoiceType === 'normal' && !existingAdvanceInvoice && !isAdvanceInvoice ? `<dijbekeroSzamlaszam>${escapeXml(existingProformaInvoice.provider_invoice_number)}</dijbekeroSzamlaszam>` : ''}
    ${isAdvanceInvoice ? '<elolegszamla>true</elolegszamla>' : ''}
    ${existingAdvanceInvoice && !isAdvanceInvoice && !isProformaWithAmount && settings.invoiceType !== 'proforma' && settings.invoiceType !== 'advance' ? '<vegszamla>true</vegszamla>' : ''}
    ${existingAdvanceInvoice && !isAdvanceInvoice && !isProformaWithAmount && settings.invoiceType !== 'proforma' && settings.invoiceType !== 'advance' ? `<elolegSzamlaszam>${escapeXml(existingAdvanceInvoice.provider_invoice_number)}</elolegSzamlaszam>` : ''}
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
    <sendEmail>${settings.sendEmail && order.customer_email ? 'true' : 'false'}</sendEmail>
    <adoszam>${escapeXml(order.billing_tax_number || '')}</adoszam>
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

    // Fetch payments to ensure order is fully paid
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from('pos_payments')
      .select('amount, deleted_at')
      .eq('pos_order_id', id)

    if (paymentsError) {
      console.error('Error fetching POS payments for invoice creation:', paymentsError)
      return NextResponse.json(
        { error: 'Hiba a fizetések lekérdezésekor' },
        { status: 500 }
      )
    }

    // Determine invoice request types
    let isAdvanceInvoiceRequest = body.invoiceType === 'advance'
    let isProformaInvoiceRequest = body.invoiceType === 'proforma'
    
    // Check for existing partial proforma BEFORE fully paid check
    // If there's a partial proforma, allow advance invoice creation even if order isn't fully paid
    let hasPartialProforma = false
    if (isAdvanceInvoiceRequest || isProformaInvoiceRequest || body.invoiceType === 'normal') {
      const { data: proformaCheck, error: proformaCheckError } = await supabaseAdmin
        .from('invoices')
        .select('gross_total')
        .eq('related_order_type', 'pos_order')
        .eq('related_order_id', id)
        .eq('invoice_type', 'dijbekero')
        .eq('provider', 'szamlazz_hu')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (!proformaCheckError && proformaCheck && proformaCheck.gross_total) {
        const proformaTotal = Number(proformaCheck.gross_total)
        const orderTotal = Number(orderData.total_gross || 0)
        hasPartialProforma = proformaTotal < orderTotal
        console.log('[INVOICE CREATION] Proforma check:', {
          proformaTotal,
          orderTotal,
          hasPartialProforma
        })
      }
    }
    
    console.log('[INVOICE CREATION] Invoice type check:', {
      invoiceType: body.invoiceType,
      isAdvanceInvoiceRequest,
      isProformaInvoiceRequest,
      hasPartialProforma,
      willSkipFullyPaidCheck: isAdvanceInvoiceRequest || isProformaInvoiceRequest || hasPartialProforma
    })
    
    // IMPORTANT: Advance invoices and proforma invoices should ALWAYS skip the "fully paid" check
    // Also skip if there's a partial proforma (allows creating advance invoice after partial proforma)
    // Only normal invoices (without partial proforma) require the order to be fully paid
    if (!isAdvanceInvoiceRequest && !isProformaInvoiceRequest && !hasPartialProforma) {
      const totalPaid = (payments || [])
        .filter(p => !p.deleted_at)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0)
      const totalDue = Number(orderData.total_gross || 0)

      // Allow 1 Ft tolerance for rounding differences
      const remaining = totalDue - totalPaid
      const tolerance = 1

      if (remaining > tolerance) {
        return NextResponse.json(
          { error: 'Csak teljesen kifizetett rendeléshez hozható létre számla' },
          { status: 400 }
        )
      }
    }
    
    // Validate advance amount if it's an advance invoice
    if (isAdvanceInvoiceRequest) {
      if (!body.advanceAmount || body.advanceAmount <= 0) {
        return NextResponse.json(
          { error: 'Előleg számla esetén az előleg összegének megadása kötelező' },
          { status: 400 }
        )
      }
    }

    // Store the original invoice type BEFORE any conversions
    const originalInvoiceType = body.invoiceType
    
    // Check if there's an existing advance invoice for this order (for final invoice)
    let existingAdvanceInvoice: { provider_invoice_number: string; gross_total: number } | null = null
    // Check if there's an existing proforma invoice for this order (for advance or normal invoice)
    let existingProformaInvoice: { provider_invoice_number: string } | null = null
    let proformaInvoiceData: { id: string; provider_invoice_number: string | null } | null = null // Store full proforma invoice data for later update
    
    // FIRST: Check for existing végszámla (final invoice) before proceeding
    // This prevents the error "A hivatkozott előlegszámla nem beazonosítható"
    const isNormalInvoiceRequest = originalInvoiceType === 'normal' || (originalInvoiceType !== 'advance' && originalInvoiceType !== 'proforma')
    
    if (isNormalInvoiceRequest && !isAdvanceInvoiceRequest && !isProformaInvoiceRequest) {
      // First check if there's an advance invoice
      const { data: advanceInvoiceCheck, error: advanceCheckError } = await supabaseAdmin
        .from('invoices')
        .select('id')
        .eq('related_order_type', 'pos_order')
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
          .eq('related_order_type', 'pos_order')
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
            .eq('related_order_type', 'pos_order')
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
      
      // Now check for existing advance invoice to create final invoice
      // IMPORTANT: Exclude stornoed advance invoices - if an advance invoice was stornoed,
      // we should treat it as if no advance invoice exists (Hungarian invoicing rules)
      console.log('Checking for existing advance invoice to create final invoice. Original request:', {
        originalInvoiceType,
        isAdvanceInvoiceRequest,
        isProformaInvoiceRequest,
        isNormalInvoiceRequest
      })
      const { data: advanceInvoiceData, error: advanceError } = await supabaseAdmin
        .from('invoices')
        .select('id, provider_invoice_number, gross_total')
        .eq('related_order_type', 'pos_order')
        .eq('related_order_id', id)
        .eq('invoice_type', 'elolegszamla')
        .eq('provider', 'szamlazz_hu')
        .is('is_storno_of_invoice_id', null) // Exclude stornoed advance invoices
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      console.log('Advance invoice query for order:', id, {
        advanceInvoiceData,
        advanceError,
        found: !!advanceInvoiceData,
        queryConditions: {
          related_order_type: 'pos_order',
          related_order_id: id,
          invoice_type: 'elolegszamla',
          provider: 'szamlazz_hu'
        }
      })
      
      if (!advanceError && advanceInvoiceData) {
        // Double-check if this advance invoice has been stornoed
        const { data: stornoCheck, error: stornoCheckError } = await supabaseAdmin
          .from('invoices')
          .select('id')
          .eq('related_order_type', 'pos_order')
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
          console.log('Found existing advance invoice for final invoice:', existingAdvanceInvoice)
        } else {
          console.log('Advance invoice found but it has been stornoed, treating as no advance invoice')
          existingAdvanceInvoice = null
        }
      } else if (advanceError) {
        console.error('Error querying advance invoice:', advanceError)
      } else {
        console.log('No advance invoice found for order:', id, '- will create normal invoice')
      }
    } else {
      console.log('Skipping advance invoice check because:', {
        originalInvoiceType,
        isAdvanceInvoiceRequest,
        isProformaInvoiceRequest,
        isNormalInvoiceRequest
      })
    }
    
    // SECOND: Check for proforma invoice (needed for advance invoice or normal invoice)
    // Only convert to advance invoice if there's NO existing advance invoice
    if (isAdvanceInvoiceRequest || (!isAdvanceInvoiceRequest && !isProformaInvoiceRequest)) {
      const { data: proformaData, error: proformaError } = await supabaseAdmin
        .from('invoices')
        .select('id, provider_invoice_number, gross_total')
        .eq('related_order_type', 'pos_order')
        .eq('related_order_id', id)
        .eq('invoice_type', 'dijbekero')
        .eq('provider', 'szamlazz_hu')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (!proformaError && proformaData) {
        proformaInvoiceData = proformaData // Store full data for later update
        existingProformaInvoice = {
          provider_invoice_number: proformaData.provider_invoice_number || ''
        }
        console.log('Found existing proforma invoice:', existingProformaInvoice, 'gross_total:', proformaData.gross_total)
        
        // If there's a proforma with partial amount and user is creating a "normal" invoice,
        // AND there's NO existing advance invoice, automatically convert it to an advance invoice using the proforma amount
        if (!isAdvanceInvoiceRequest && !isProformaInvoiceRequest && !existingAdvanceInvoice && proformaData.gross_total) {
          const proformaGrossTotal = Number(proformaData.gross_total)
          const orderTotal = Number(orderData.total_gross || 0)
          
          // If proforma amount is less than order total, it's a partial proforma
          // In this case, create an advance invoice instead of a normal invoice
          if (proformaGrossTotal < orderTotal) {
            console.log('Proforma has partial amount, converting normal invoice to advance invoice')
            // Override invoice type to advance and use proforma amount
            body.invoiceType = 'advance'
            body.advanceAmount = proformaGrossTotal
            isAdvanceInvoiceRequest = true
            isProformaInvoiceRequest = false
            console.log('Converted to advance invoice with amount:', proformaGrossTotal)
          }
        }
      }
    }

    // Build XML request
    console.log('Building invoice XML with existingAdvanceInvoice:', existingAdvanceInvoice, 'existingProformaInvoice:', existingProformaInvoice)
    console.log('Invoice request body:', { invoiceType: body.invoiceType, isAdvanceInvoiceRequest, isProformaInvoiceRequest })
    const xmlRequest = buildInvoiceXml(
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
    console.log('XML contains advance deduction:', xmlRequest.includes('Előleg levonása'))
    // Log a snippet of the tetelek section to verify structure
    const tetelekMatch = xmlRequest.match(/<tetelek>([\s\S]*?)<\/tetelek>/)
    if (tetelekMatch) {
      console.log('Tetelek section preview:', tetelekMatch[1].substring(0, 500))
    }

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

    // Resolve customer_id: prefer stored customer_id; if missing, try to match existing customer by tax number/email/name
    let resolvedCustomerId: string | null = orderData.customer_id || null
    if (!resolvedCustomerId) {
      const orFilters: string[] = []
      if (orderData.billing_tax_number) {
        orFilters.push(`billing_tax_number.eq.${orderData.billing_tax_number}`)
      }
      if (orderData.customer_email) {
        orFilters.push(`email.eq.${orderData.customer_email}`)
      }
      if (orderData.customer_name) {
        // Avoid commas or special chars in OR filter; use ilike with escaped value if needed
        const safeName = orderData.customer_name.replace(/,/g, '\\,')
        orFilters.push(`name.ilike.${safeName}`)
      }
      if (orFilters.length > 0) {
        const { data: customerMatch, error: customerErr } = await supabaseAdmin
          .from('customers')
          .select('id')
          .or(orFilters.join(','))
          .limit(1)
          .maybeSingle()
        if (!customerErr && customerMatch?.id) {
          resolvedCustomerId = customerMatch.id as string
        }
      }
    }

    // Persist invoice record (basic fields)
    // If persistence fails, surface the error so we can fix DB issues instead of silently succeeding
    // We still already created the invoice at the provider, so include provider number in the error for manual recovery
    // Note: internal_number uses RPC for eager allocation but DB default will generate if RPC fails
    //       (helps avoid gaps when provider succeeded but RPC did not)
    let internalNumber: string | null = null
      try {
        const { data: internalRes, error: internalErr } = await supabaseAdmin
          .rpc('next_internal_invoice_number')
        if (!internalErr && internalRes) {
          internalNumber = internalRes as string
      } else if (internalErr) {
        console.warn('Internal number RPC returned error; relying on DB default:', internalErr)
        }
      } catch (e) {
        console.warn('Internal number RPC failed; relying on DB default:', e)
      }

    // For advance invoices, use advance amount
    // For final invoices (with existing advance), use order total minus advance amount
    // Calculate invoice gross total
    let invoiceGrossTotal: number | null = null
    if (isAdvanceInvoiceRequest && body.advanceAmount) {
      invoiceGrossTotal = body.advanceAmount
    } else if (isProformaInvoiceRequest && body.proformaAmount && body.proformaAmount > 0) {
      invoiceGrossTotal = body.proformaAmount
    } else if (existingAdvanceInvoice) {
      // Final invoice: remaining amount after advance
      const orderTotal = Number(orderData.total_gross || 0)
      const advanceTotal = existingAdvanceInvoice.gross_total
      invoiceGrossTotal = orderTotal - advanceTotal
    } else {
      invoiceGrossTotal = orderData.total_gross || null
    }

      const invoiceRow: any = {
        provider: 'szamlazz_hu',
        provider_invoice_number: finalInvoiceNumber,
        provider_invoice_id: finalInvoiceNumber,
      invoice_type: isAdvanceInvoiceRequest ? 'elolegszamla' : isProformaInvoiceRequest ? 'dijbekero' : 'szamla', // Use appropriate invoice type
        related_order_type: 'pos_order',
        related_order_id: id,
        related_order_number: orderData.pos_order_number,
        customer_name: orderData.billing_name || orderData.customer_name || '',
      customer_id: resolvedCustomerId,
        payment_due_date: body.dueDate || null,
        fulfillment_date: body.fulfillmentDate || body.dueDate || null,
      gross_total: invoiceGrossTotal,
      payment_status: isProformaInvoiceRequest ? 'fizetesre_var' : 'fizetve', // Proforma invoices are not paid yet
        is_storno_of_invoice_id: null,
        pdf_url: finalInvoiceNumber
          ? `/api/invoices/pdf?number=${encodeURIComponent(finalInvoiceNumber)}&provider=szamlazz_hu`
          : null
      }

      if (internalNumber) {
        invoiceRow.internal_number = internalNumber
      }

    const { error: insertError, data: insertData } = await supabaseAdmin
      .from('invoices')
      .insert([invoiceRow])
      .select()
      .single()

    if (insertError) {
      console.error('Failed to persist invoice record:', insertError, { invoiceRow })
      return NextResponse.json(
        {
          error: 'Számla létrejött a szolgáltatónál, de nem sikerült menteni az adatbázisba',
          providerInvoiceNumber: finalInvoiceNumber,
          details: insertError.message
        },
        { status: 500 }
      )
    }

    // If this is a normal invoice created based on a proforma invoice, update the proforma invoice's payment status to "fizetve"
    if (!isAdvanceInvoiceRequest && !isProformaInvoiceRequest && existingProformaInvoice && proformaInvoiceData?.id) {
      const { error: updateProformaError } = await supabaseAdmin
        .from('invoices')
        .update({ payment_status: 'fizetve' })
        .eq('id', proformaInvoiceData.id)
      
      if (updateProformaError) {
        console.error('Failed to update proforma invoice payment status:', updateProformaError)
        // Don't fail the whole request, just log the error
      } else {
        console.log('Successfully updated proforma invoice payment status to "fizetve" for invoice:', proformaInvoiceData.id)
      }
    }

    return NextResponse.json({
      success: true,
      invoiceNumber: finalInvoiceNumber,
      invoice: insertData || null,
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
