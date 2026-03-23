import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { normalizeSzamlazzApiUrl } from '@/lib/szamlazz-agent'
import { getSzamlazzConnectionForOrder } from '@/lib/shop-szamlazz-connection'

const RELATED = 'order' as const
const PROVIDER = 'szamlazz_hu'

interface StornoRequest {
  providerInvoiceNumber: string
}

function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return ''
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildStornoXml(agentKey: string, invoiceNumber: string, buyerEmail?: string | null) {
  const today = new Date().toISOString().split('T')[0]
  return `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamlast xmlns="http://www.szamlazz.hu/xmlszamlast" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamlast https://www.szamlazz.hu/szamla/docs/xsds/agentst/xmlszamlast.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(agentKey)}</szamlaagentkulcs>
    <eszamla>false</eszamla>
    <szamlaLetoltes>true</szamlaLetoltes>
    <szamlaLetoltesPld>1</szamlaLetoltesPld>
  </beallitasok>
  <fejlec>
    <szamlaszam>${escapeXml(invoiceNumber)}</szamlaszam>
    <keltDatum>${today}</keltDatum>
    <tipus>SS</tipus>
  </fejlec>
  <elado></elado>
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
    const { id: orderId } = await params
    const supabase = await getTenantSupabase()
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as StornoRequest
    if (!body?.providerInvoiceNumber?.trim()) {
      return NextResponse.json({ error: 'providerInvoiceNumber kötelező' }, { status: 400 })
    }

    const { data: originalInvoice, error: originalErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('provider_invoice_number', body.providerInvoiceNumber.trim())
      .eq('provider', PROVIDER)
      .eq('related_order_type', RELATED)
      .eq('related_order_id', orderId)
      .is('deleted_at', null)
      .maybeSingle()

    if (originalErr || !originalInvoice) {
      return NextResponse.json(
        { error: 'Eredeti számla nem található ehhez a rendeléshez' },
        { status: 404 }
      )
    }

    const { data: orderRow } = await supabase
      .from('orders')
      .select('connection_id, customer_email')
      .eq('id', orderId)
      .is('deleted_at', null)
      .single()

    const connection = await getSzamlazzConnectionForOrder(supabase, orderRow ?? { connection_id: null })
    if (!connection?.password) {
      return NextResponse.json(
        { error: 'Nincs Számlázz Agent kapcsolat a művelethez' },
        { status: 400 }
      )
    }

    const agentKey = String(connection.password).trim()
    const apiUrl = normalizeSzamlazzApiUrl(connection.api_url)

    if (originalInvoice.invoice_type === 'dijbekero') {
      const deleteXml = `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamladbkdel xmlns="http://www.szamlazz.hu/xmlszamladbkdel" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamladbkdel http://www.szamlazz.hu/docs/xsds/szamladbkdel/xmlszamladbkdel.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(agentKey)}</szamlaagentkulcs>
  </beallitasok>
  <fejlec>
    <szamlaszam>${escapeXml(body.providerInvoiceNumber)}</szamlaszam>
  </fejlec>
</xmlszamladbkdel>`

      const formData = new FormData()
      const xmlBlob = new Blob([deleteXml], { type: 'application/xml; charset=utf-8' })
      formData.append('action-szamla_agent_dijbekero_torlese', xmlBlob, 'delete.xml')

      const response = await fetch(apiUrl, { method: 'POST', body: formData })
      const responseText = await response.text()

      const successMatch = responseText.match(/<sikeres>([^<]+)<\/sikeres>/i)
      const isSuccessful = successMatch && successMatch[1].toLowerCase() === 'true'

      if (!isSuccessful) {
        const errorCodeMatch = responseText.match(/<hibakod>([^<]+)<\/hibakod>/i)
        const errorMessageMatch = responseText.match(/<hibauzenet>([^<]+)<\/hibauzenet>/i)
        const errorCode = errorCodeMatch ? errorCodeMatch[1] : 'Unknown'
        const errorMessage = errorMessageMatch ? errorMessageMatch[1] : 'Ismeretlen hiba'

        if (errorCode !== '335') {
          return NextResponse.json(
            { error: `Szamlazz.hu hiba${errorCode ? ` (${errorCode})` : ''}: ${errorMessage}` },
            { status: 400 }
          )
        }
      }

      const { error: deleteErr } = await supabase
        .from('invoices')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', originalInvoice.id)

      if (deleteErr) {
        return NextResponse.json(
          { error: 'Díjbekérő törölve a szolgáltatónál, de nem sikerült frissíteni az adatbázisban', details: deleteErr.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Díjbekérő sikeresen törölve',
        deleted: true
      })
    }

    const buyerEmail = orderRow?.customer_email ? String(orderRow.customer_email).trim() : null
    const xml = buildStornoXml(agentKey, body.providerInvoiceNumber, buyerEmail)

    const formData = new FormData()
    const xmlBlob = new Blob([xml], { type: 'application/xml; charset=utf-8' })
    formData.append('action-szamla_agent_st', xmlBlob, 'storno.xml')

    const response = await fetch(apiUrl, { method: 'POST', body: formData })

    const contentType = response.headers.get('content-type') || ''
    const isPdf = contentType.includes('application/pdf') || contentType.includes('pdf')
    const errorCode = response.headers.get('szlahu_error_code')
    const errorMessage = response.headers.get('szlahu_error')
    const newInvoiceNumber = response.headers.get('szlahu_szamlaszam')
    const responseText = await response.text()

    if (errorCode || errorMessage) {
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

    const stornoRow: Record<string, unknown> = {
      provider: PROVIDER,
      provider_invoice_number: finalInvoiceNumber,
      provider_invoice_id: finalInvoiceNumber,
      invoice_type: 'sztorno',
      related_order_type: RELATED,
      related_order_id: orderId,
      related_order_number: originalInvoice.related_order_number,
      customer_name: originalInvoice.customer_name || '',
      customer_id: originalInvoice.customer_id || null,
      payment_due_date: originalInvoice.payment_due_date || null,
      fulfillment_date: originalInvoice.fulfillment_date || null,
      gross_total: originalInvoice.gross_total || null,
      payment_status: 'nem_lesz_fizetve',
      is_storno_of_invoice_id: originalInvoice.id,
      pdf_url: null,
      connection_id: connection.id
    }

    const { error: insertErr, data: insertData } = await supabase
      .from('invoices')
      .insert(stornoRow)
      .select()
      .single()

    if (insertErr) {
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
  } catch (error: unknown) {
    console.error('storno-invoice', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Belső szerver hiba' },
      { status: 500 }
    )
  }
}
