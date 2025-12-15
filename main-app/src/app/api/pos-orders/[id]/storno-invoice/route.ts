import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const SZAMLAZZ_AGENT_KEY = process.env.SZAMLAZZ_AGENT_KEY || 'zatx49i6i2jgw3yj4a9bkmtrzcwditxceyifacy257'
const SZAMLAZZ_API_URL = process.env.SZAMLAZZ_API_URL || 'https://www.szamlazz.hu/szamla/'

interface StornoRequest {
  providerInvoiceNumber: string
}

function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return ''
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildStornoXml(invoiceNumber: string, buyerEmail?: string | null) {
  const today = new Date().toISOString().split('T')[0]
  return `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamlast xmlns="http://www.szamlazz.hu/xmlszamlast" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamlast https://www.szamlazz.hu/szamla/docs/xsds/agentst/xmlszamlast.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(SZAMLAZZ_AGENT_KEY)}</szamlaagentkulcs>
    <eszamla>false</eszamla>
    <szamlaLetoltes>true</szamlaLetoltes>
    <szamlaLetoltesPld>1</szamlaLetoltesPld>
  </beallitasok>
  <fejlec>
    <szamlaszam>${escapeXml(invoiceNumber)}</szamlaszam>
    <keltDatum>${today}</keltDatum>
    <tipus>SS</tipus>
  </fejlec>
  <elado>
    <!-- optional email fields; left blank -->
  </elado>
  <vevo>
    ${buyerEmail ? `<email>${escapeXml(buyerEmail)}</email>` : ''}
  </vevo>
</xmlszamlast>`
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = (await request.json()) as StornoRequest

    if (!body?.providerInvoiceNumber) {
      return NextResponse.json({ error: 'providerInvoiceNumber kötelező' }, { status: 400 })
    }

    // Lookup original invoice to link storno and get buyer email
    const { data: originalInvoice, error: originalErr } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('provider_invoice_number', body.providerInvoiceNumber)
      .eq('provider', 'szamlazz_hu')
      .limit(1)
      .single()

    if (originalErr || !originalInvoice) {
      return NextResponse.json(
        { error: 'Eredeti számla nem található a megadott számlaszámmal' },
        { status: 404 }
      )
    }

    // Build storno XML
    // Fetch order to get buyer email (optional)
    let buyerEmail: string | null = null
    const { data: orderData } = await supabaseAdmin
      .from('pos_orders')
      .select('customer_email')
      .eq('id', id)
      .limit(1)
      .single()
    if (orderData?.customer_email) {
      buyerEmail = orderData.customer_email
    }

    const xml = buildStornoXml(body.providerInvoiceNumber, buyerEmail)

    const formData = new FormData()
    const xmlBlob = new Blob([xml], { type: 'application/xml; charset=utf-8' })
    formData.append('action-szamla_agent_st', xmlBlob, 'storno.xml')

    const response = await fetch(SZAMLAZZ_API_URL, { method: 'POST', body: formData })

    const contentType = response.headers.get('content-type') || ''
    const isPdf = contentType.includes('application/pdf') || contentType.includes('pdf')

    const errorCode = response.headers.get('szlahu_error_code')
    const errorMessage = response.headers.get('szlahu_error')
    const newInvoiceNumber = response.headers.get('szlahu_szamlaszam')

    const responseText = await response.text()

    if (errorCode || errorMessage) {
      console.error('Szamlazz.hu storno API error:', { errorCode, errorMessage, response: responseText })
      return NextResponse.json(
        { error: `Szamlazz.hu hiba${errorCode ? ` (${errorCode})` : ''}: ${errorMessage || 'Ismeretlen hiba'}` },
        { status: 400 }
      )
    }

    let finalInvoiceNumber = newInvoiceNumber
    if (!finalInvoiceNumber && !isPdf && responseText) {
      const invoiceNumberMatch = responseText.match(/<szamlaszam>([^<]+)<\/szamlaszam>/i)
      finalInvoiceNumber = invoiceNumberMatch ? invoiceNumberMatch[1] : null
    }

    if (!finalInvoiceNumber) {
      return NextResponse.json(
        { error: 'Sztornó számlaszám nem található a válaszban', details: responseText.substring(0, 500) },
        { status: 400 }
      )
    }

    // Persist storno invoice record
    let internalNumber: string | null = null
    try {
      const { data: internalRes, error: internalErr } = await supabaseAdmin.rpc('next_internal_invoice_number')
      if (!internalErr && internalRes) internalNumber = internalRes as string
    } catch (e) {
      console.warn('Internal number RPC failed for storno; relying on DB default:', e)
    }

    const stornoRow: any = {
      provider: 'szamlazz_hu',
      provider_invoice_number: finalInvoiceNumber,
      provider_invoice_id: finalInvoiceNumber,
      invoice_type: 'sztorno',
      related_order_type: 'pos_order',
      related_order_id: id,
      related_order_number: originalInvoice.related_order_number,
      customer_name: originalInvoice.customer_name || '',
      customer_id: originalInvoice.customer_id || null,
      payment_due_date: originalInvoice.payment_due_date || null,
      fulfillment_date: originalInvoice.fulfillment_date || null,
      gross_total: originalInvoice.gross_total || null,
      payment_status: 'nem_lesz_fizetve',
      is_storno_of_invoice_id: originalInvoice.id,
      pdf_url: finalInvoiceNumber
        ? `/api/invoices/pdf?number=${encodeURIComponent(finalInvoiceNumber)}&provider=szamlazz_hu`
        : null
    }

    if (internalNumber) {
      stornoRow.internal_number = internalNumber
    }

    const { error: insertErr, data: insertData } = await supabaseAdmin
      .from('invoices')
      .insert([stornoRow])
      .select()
      .single()

    if (insertErr) {
      console.error('Failed to insert storno invoice:', insertErr, { stornoRow })
      return NextResponse.json(
        {
          error: 'Sztornó számla létrejött a szolgáltatónál, de nem sikerült menteni az adatbázisba',
          providerInvoiceNumber: finalInvoiceNumber,
          details: insertErr.message
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      invoiceNumber: finalInvoiceNumber,
      invoice: insertData
    })
  } catch (error: any) {
    console.error('Unhandled error creating storno invoice:', error)
    return NextResponse.json(
      { error: error.message || 'Belső szerver hiba történt sztornó számlánál' },
      { status: 500 }
    )
  }
}


