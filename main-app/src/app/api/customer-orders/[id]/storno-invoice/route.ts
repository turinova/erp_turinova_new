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

    // If the invoice is a díjbekérő (proforma), delete it instead of creating a storno
    if (originalInvoice.invoice_type === 'dijbekero') {
      console.log('Deleting proforma invoice instead of creating storno:', body.providerInvoiceNumber)
      
      // Build delete XML for proforma invoice
      const deleteXml = `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamladbkdel xmlns="http://www.szamlazz.hu/xmlszamladbkdel" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamladbkdel http://www.szamlazz.hu/docs/xsds/szamladbkdel/xmlszamladbkdel.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(SZAMLAZZ_AGENT_KEY)}</szamlaagentkulcs>
  </beallitasok>
  <fejlec>
    <szamlaszam>${escapeXml(body.providerInvoiceNumber)}</szamlaszam>
  </fejlec>
</xmlszamladbkdel>`

      const formData = new FormData()
      const xmlBlob = new Blob([deleteXml], { type: 'application/xml; charset=utf-8' })
      formData.append('action-szamla_agent_dijbekero_torlese', xmlBlob, 'delete.xml')

      const response = await fetch(SZAMLAZZ_API_URL, { method: 'POST', body: formData })
      const responseText = await response.text()

      console.log('Delete Proforma Invoice - Response:', responseText.substring(0, 500))

      // Check for success in XML response
      const successMatch = responseText.match(/<sikeres>([^<]+)<\/sikeres>/i)
      const isSuccessful = successMatch && successMatch[1].toLowerCase() === 'true'

      if (!isSuccessful) {
        // Check for errors
        const errorCodeMatch = responseText.match(/<hibakod>([^<]+)<\/hibakod>/i)
        const errorMessageMatch = responseText.match(/<hibauzenet>([^<]+)<\/hibauzenet>/i)
        
        const errorCode = errorCodeMatch ? errorCodeMatch[1] : 'Unknown'
        const errorMessage = errorMessageMatch ? errorMessageMatch[1] : 'Ismeretlen hiba'
        
        // Error code 335 means "Nincs ilyen díjbekérő" (No such proforma invoice)
        // This is acceptable - the invoice is already gone
        if (errorCode === '335') {
          console.log(`Proforma invoice ${body.providerInvoiceNumber} already deleted (error 335) - treating as success`)
        } else {
          console.error('Delete Proforma Invoice - Error:', {
            code: errorCode,
            message: errorMessage,
            response: responseText.substring(0, 500)
          })
          return NextResponse.json(
            { 
              error: `Szamlazz.hu hiba${errorCode ? ` (${errorCode})` : ''}: ${errorMessage}`,
            },
            { status: 400 }
          )
        }
      }

      // Soft delete the invoice record from database (keep for history/display)
      const { error: deleteErr } = await supabaseAdmin
        .from('invoices')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', originalInvoice.id)

      if (deleteErr) {
        console.error('Failed to soft delete proforma invoice from database:', deleteErr)
        return NextResponse.json(
          {
            error: 'Díjbekérő törölve a szolgáltatónál, de nem sikerült frissíteni az adatbázisban',
            details: deleteErr.message
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Díjbekérő sikeresen törölve',
        deleted: true
      })
    }

    // Build storno XML for regular invoices
    // Fetch order to get buyer email (optional)
    let buyerEmail: string | null = null
    const { data: orderData } = await supabaseAdmin
      .from('customer_orders')
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
      related_order_type: 'customer_order',
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

