import { NextRequest, NextResponse } from 'next/server'

const SZAMLAZZ_AGENT_KEY = process.env.SZAMLAZZ_AGENT_KEY || 'zatx49i6i2jgw3yj4a9bkmtrzcwditxceyifacy257'
const SZAMLAZZ_API_URL = process.env.SZAMLAZZ_API_URL || 'https://www.szamlazz.hu/szamla/'

interface DeletePreviewInvoiceRequest {
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

// Build XML request for deleting proforma invoice
function buildDeleteXml(invoiceNumber: string): string {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamladbkdel xmlns="http://www.szamlazz.hu/xmlszamladbkdel" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamladbkdel http://www.szamlazz.hu/docs/xsds/szamladbkdel/xmlszamladbkdel.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(SZAMLAZZ_AGENT_KEY)}</szamlaagentkulcs>
  </beallitasok>
  <fejlec>
    <szamlaszam>${escapeXml(invoiceNumber)}</szamlaszam>
  </fejlec>
</xmlszamladbkdel>`

  return xml
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body: DeletePreviewInvoiceRequest = await request.json()

    if (!body.invoiceNumber) {
      return NextResponse.json(
        { error: 'Számlaszám szükséges' },
        { status: 400 }
      )
    }

    // Build XML request
    const xmlRequest = buildDeleteXml(body.invoiceNumber)

    // Send request to szamlazz.hu as multipart/form-data
    const apiUrl = SZAMLAZZ_API_URL
    const formData = new FormData()
    const xmlBlob = new Blob([xmlRequest], { type: 'application/xml; charset=utf-8' })
    formData.append('action-szamla_agent_dijbekero_torlese', xmlBlob, 'delete.xml')
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData
    })

    // Read response
    const responseText = await response.text()
    
    console.log('Delete Preview Invoice - Response:', responseText.substring(0, 500))

    // Check for success in XML response
    const successMatch = responseText.match(/<sikeres>([^<]+)<\/sikeres>/i)
    const isSuccessful = successMatch && successMatch[1].toLowerCase() === 'true'

    if (!isSuccessful) {
      // Check for errors
      const errorCodeMatch = responseText.match(/<hibakod>([^<]+)<\/hibakod>/i)
      const errorMessageMatch = responseText.match(/<hibauzenet>([^<]+)<\/hibauzenet>/i)
      
      const errorCode = errorCodeMatch ? errorCodeMatch[1] : 'Unknown'
      const errorMessage = errorMessageMatch ? errorMessageMatch[1] : 'Ismeretlen hiba'
      
      console.error('Delete Preview Invoice - Error:', {
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

    return NextResponse.json({
      success: true,
      message: 'Preview számla sikeresen törölve'
    })

  } catch (error: any) {
    console.error('Error deleting preview invoice:', error)
    return NextResponse.json(
      { error: error.message || 'Belső szerver hiba történt' },
      { status: 500 }
    )
  }
}


