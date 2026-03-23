import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { normalizeSzamlazzApiUrl } from '@/lib/szamlazz-agent'
import { getSzamlazzConnectionForOrder } from '@/lib/shop-szamlazz-connection'
import { escapeXml } from '@/lib/szamlazz-shop-xml'

function buildQueryPdfXml(agentKey: string, invoiceNumber: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamlapdf xmlns="http://www.szamlazz.hu/xmlszamlapdf" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamlapdf https://www.szamlazz.hu/szamla/docs/xsds/agentpdf/xmlszamlapdf.xsd">
  <szamlaagentkulcs>${escapeXml(agentKey)}</szamlaagentkulcs>
  <szamlaszam>${escapeXml(invoiceNumber)}</szamlaszam>
  <valaszVerzio>2</valaszVerzio>
  <szamlaKulsoAzon></szamlaKulsoAzon>
</xmlszamlapdf>`
}

function isPdfMagic(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 // %PDF
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

    const body = await request.json().catch(() => ({}))
    const invoiceNumber = typeof body.invoiceNumber === 'string' ? body.invoiceNumber.trim() : ''
    if (!invoiceNumber) {
      return NextResponse.json({ error: 'Számlaszám szükséges' }, { status: 400 })
    }

    const { data: order } = await supabase
      .from('orders')
      .select('connection_id')
      .eq('id', orderId)
      .is('deleted_at', null)
      .single()

    if (!order) {
      return NextResponse.json({ error: 'Rendelés nem található' }, { status: 404 })
    }

    const connection = await getSzamlazzConnectionForOrder(supabase, order)
    if (!connection?.password) {
      return NextResponse.json({ error: 'Nincs Számlázz kapcsolat' }, { status: 400 })
    }

    const agentKey = String(connection.password).trim()
    const xmlRequest = buildQueryPdfXml(agentKey, invoiceNumber)
    const apiUrl = normalizeSzamlazzApiUrl(connection.api_url)
    const formData = new FormData()
    const xmlBlob = new Blob([xmlRequest], { type: 'application/xml; charset=utf-8' })
    formData.append('action-szamla_agent_pdf', xmlBlob, 'query.xml')

    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(120000)
    })

    const errorCode = response.headers.get('szlahu_error_code')
    let errorMessage = response.headers.get('szlahu_error')
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
          success: false,
          error: `Szamlazz.hu hiba${errorCode ? ` (${errorCode})` : ''}: ${errorMessage || 'Ismeretlen hiba'}`
        },
        { status: 400 }
      )
    }

    const contentType = response.headers.get('content-type') || ''
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Direct PDF bytes (some responses omit application/pdf)
    if (contentType.includes('application/pdf') || contentType.includes('pdf') || isPdfMagic(buffer)) {
      return NextResponse.json({
        success: true,
        pdf: buffer.toString('base64'),
        mimeType: 'application/pdf'
      })
    }

    const responseText = buffer.toString('utf-8')

    if (responseText.includes('<hibakod>') || responseText.includes('<hibauzenet>')) {
      const errorCodeMatch = responseText.match(/<hibakod[^>]*>([^<]+)<\/hibakod>/i)
      const errorMessageMatch = responseText.match(/<hibauzenet[^>]*>([^<]+)<\/hibauzenet>/i)
      return NextResponse.json(
        {
          success: false,
          error: `Szamlazz.hu XML hiba${errorCodeMatch ? ` (${errorCodeMatch[1]})` : ''}: ${errorMessageMatch ? errorMessageMatch[1] : 'Ismeretlen'}`
        },
        { status: 400 }
      )
    }

    // valaszVerzio=2: PDF as base64 inside XML (may span lines)
    const pdfMatch =
      responseText.match(/<pdf[^>]*>([\s\S]*?)<\/pdf>/i) ||
      responseText.match(/<pdfTartalom[^>]*>([\s\S]*?)<\/pdfTartalom>/i)
    const pdfB64 = pdfMatch?.[1]?.replace(/\s+/g, '').trim()
    if (pdfB64) {
      return NextResponse.json({
        success: true,
        pdf: pdfB64,
        mimeType: 'application/pdf'
      })
    }

    console.error('query-invoice-pdf: unexpected response', {
      contentType,
      head: responseText.substring(0, 300)
    })

    return NextResponse.json(
      {
        success: false,
        error: 'PDF nem található a válaszban (nem PDF és nincs base64 a XML-ben)',
        details: responseText.substring(0, 500)
      },
      { status: 502 }
    )
  } catch (e) {
    console.error('query-invoice-pdf', e)
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Belső hiba' },
      { status: 500 }
    )
  }
}
