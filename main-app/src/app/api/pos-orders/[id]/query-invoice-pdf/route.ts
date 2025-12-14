import { NextRequest, NextResponse } from 'next/server'

const SZAMLAZZ_AGENT_KEY = process.env.SZAMLAZZ_AGENT_KEY || 'zatx49i6i2jgw3yj4a9bkmtrzcwditxceyifacy257'
const SZAMLAZZ_API_URL = process.env.SZAMLAZZ_API_URL || 'https://www.szamlazz.hu/szamla/'

interface QueryInvoicePdfRequest {
  invoiceNumber: string
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

// Build XML request for querying invoice PDF
// According to https://docs.szamlazz.hu/agent/querying_pdf/xml
// The structure is flat - no beallitasok or fejlec wrappers
function buildQueryPdfXml(invoiceNumber: string): string {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamlapdf xmlns="http://www.szamlazz.hu/xmlszamlapdf" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamlapdf https://www.szamlazz.hu/szamla/docs/xsds/agentpdf/xmlszamlapdf.xsd">
  <szamlaagentkulcs>${escapeXml(SZAMLAZZ_AGENT_KEY)}</szamlaagentkulcs>
  <szamlaszam>${escapeXml(invoiceNumber)}</szamlaszam>
  <valaszVerzio>2</valaszVerzio>
  <szamlaKulsoAzon></szamlaKulsoAzon>
</xmlszamlapdf>`

  return xml
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body: QueryInvoicePdfRequest = await request.json()

    if (!body.invoiceNumber) {
      return NextResponse.json(
        { error: 'Számlaszám szükséges' },
        { status: 400 }
      )
    }

    // Build XML request
    const xmlRequest = buildQueryPdfXml(body.invoiceNumber)
    
    // Log XML for debugging (first 500 chars)
    console.log('Query PDF XML request (first 500 chars):', xmlRequest.substring(0, 500))
    console.log('Agent Key present:', !!SZAMLAZZ_AGENT_KEY && SZAMLAZZ_AGENT_KEY.length > 0)

    // Send request to szamlazz.hu as multipart/form-data
    const apiUrl = SZAMLAZZ_API_URL
    const formData = new FormData()
    const xmlBlob = new Blob([xmlRequest], { type: 'application/xml; charset=utf-8' })
    formData.append('action-szamla_agent_pdf', xmlBlob, 'query.xml')
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData
    })

    // Check content type
    const contentType = response.headers.get('content-type') || ''
    const isPdf = contentType.includes('application/pdf') || contentType.includes('pdf')
    
    // Check for errors in headers
    const errorCode = response.headers.get('szlahu_error_code')
    const errorMessage = response.headers.get('szlahu_error')

    if (errorCode || errorMessage) {
      console.error('Query Invoice PDF - Szamlazz.hu API error:', {
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
        
        console.log('Query Invoice PDF - PDF received, size:', buffer.length, 'bytes')
        
        return NextResponse.json({
          success: true,
          pdf: base64,
          mimeType: 'application/pdf'
        })
      } catch (err) {
        console.error('Query Invoice PDF - Error reading PDF response:', err)
        return NextResponse.json(
          { error: 'Hiba a PDF válasz feldolgozása során' },
          { status: 500 }
        )
      }
    }

    // Handle XML/text response
    const responseText = await response.text()
    
    // Check for errors in XML response
    if (responseText && (responseText.includes('<hibakod>') || responseText.includes('<hibauzenet>'))) {
      const errorCodeMatch = responseText.match(/<hibakod>([^<]+)<\/hibakod>/i)
      const errorMessageMatch = responseText.match(/<hibauzenet>([^<]+)<\/hibauzenet>/i)
      
      if (errorCodeMatch || errorMessageMatch) {
        return NextResponse.json(
          { 
            error: `Szamlazz.hu XML hiba${errorCodeMatch ? ` (${errorCodeMatch[1]})` : ''}: ${errorMessageMatch ? errorMessageMatch[1] : 'Ismeretlen hiba'}`,
          },
          { status: 400 }
        )
      }
    }

    // Check if PDF is embedded in XML
    const pdfMatch = responseText.match(/<pdf>([^<]+)<\/pdf>/i) || 
                     responseText.match(/<pdfTartalom>([^<]+)<\/pdfTartalom>/i)
    if (pdfMatch && pdfMatch[1]) {
      return NextResponse.json({
        success: true,
        pdf: pdfMatch[1],
        mimeType: 'application/pdf'
      })
    }

    return NextResponse.json(
      { error: 'Váratlan válasz formátum - PDF nem található' },
      { status: 500 }
    )

  } catch (error: any) {
    console.error('Error querying invoice PDF:', error)
    return NextResponse.json(
      { error: error.message || 'Belső szerver hiba történt' },
      { status: 500 }
    )
  }
}

