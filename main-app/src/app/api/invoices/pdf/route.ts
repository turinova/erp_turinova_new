import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Minimal PDF fetch proxy for Szamlazz.hu
// Expects query params: number (provider invoice number), provider (optional, default szamlazz_hu)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const SZAMLAZZ_AGENT_KEY = process.env.SZAMLAZZ_AGENT_KEY || 'zatx49i6i2jgw3yj4a9bkmtrzcwditxceyifacy257'
const SZAMLAZZ_API_URL = process.env.SZAMLAZZ_API_URL || 'https://www.szamlazz.hu/szamla/'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const number = searchParams.get('number')
  const provider = searchParams.get('provider') || 'szamlazz_hu'

  if (!number) {
    return NextResponse.json({ error: 'number is required' }, { status: 400 })
  }

  if (provider !== 'szamlazz_hu') {
    return NextResponse.json({ error: 'unsupported provider' }, { status: 400 })
  }

  try {
    // Build XML per Számlázz.hu minta (pdf lekérés)
    // Reference: https://docs.szamlazz.hu/hu/agent/querying_pdf/xsd and response notes
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamlapdf xmlns="http://www.szamlazz.hu/xmlszamlapdf" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamlapdf https://www.szamlazz.hu/szamla/docs/xsds/agentpdf/xmlszamlapdf.xsd">
  <szamlaagentkulcs>${SZAMLAZZ_AGENT_KEY}</szamlaagentkulcs>
  <szamlaszam>${number}</szamlaszam>
  <valaszVerzio>1</valaszVerzio>
</xmlszamlapdf>`

    const formData = new FormData()
    const xmlBlob = new Blob([xml], { type: 'application/xml; charset=utf-8' })
    formData.append('action-szamla_agent_pdf', xmlBlob, 'invoice-pdf.xml')

    const response = await fetch(SZAMLAZZ_API_URL, {
      method: 'POST',
      body: formData
    })

    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('pdf')) {
      const pdfBuffer = Buffer.from(await response.arrayBuffer())
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${number}.pdf"`
        }
      })
    }

    // If not PDF, try to read text/XML and return error details
    const text = await response.text()
    return NextResponse.json({ error: 'PDF fetch failed', details: text }, { status: 400 })
  } catch (err: any) {
    console.error('Error fetching invoice PDF:', err)
    return NextResponse.json({ error: err.message || 'PDF fetch error' }, { status: 500 })
  }
}

