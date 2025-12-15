import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const SZAMLAZZ_AGENT_KEY = process.env.SZAMLAZZ_AGENT_KEY || 'zatx49i6i2jgw3yj4a9bkmtrzcwditxceyifacy257'
const SZAMLAZZ_API_URL = process.env.SZAMLAZZ_API_URL || 'https://www.szamlazz.hu/szamla/'

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

// POST /api/invoices/[id]/storno - Create storno invoice for any invoice
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { providerInvoiceNumber } = body

    if (!providerInvoiceNumber) {
      return NextResponse.json(
        { error: 'Hiányzik a számlaszám' },
        { status: 400 }
      )
    }

    // Fetch the original invoice
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: 'Számla nem található' },
        { status: 404 }
      )
    }

    if (invoice.invoice_type === 'sztorno') {
      return NextResponse.json(
        { error: 'Ez a számla már sztornó számla' },
        { status: 400 }
      )
    }

    // Build storno XML request
    const invoiceDate = invoice.created_at 
      ? new Date(invoice.created_at).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]

    const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamlast xmlns="http://www.szamlazz.hu/xmlszamlast" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamlast https://www.szamlazz.hu/szamla/docs/xsds/agentst/xmlszamlast.xsd">
  <beallitasok>
    <szamlaagentkulcs>${SZAMLAZZ_AGENT_KEY}</szamlaagentkulcs>
    <eszamla>false</eszamla>
    <szamlaLetoltes>true</szamlaLetoltes>
    <szamlaLetoltesPld>1</szamlaLetoltesPld>
  </beallitasok>
  <fejlec>
    <szamlaszam>${escapeXml(providerInvoiceNumber)}</szamlaszam>
    <keltDatum>${invoiceDate}</keltDatum>
    <tipus>SS</tipus>
  </fejlec>
</xmlszamlast>`

    // Send request to szamlazz.hu
    const formData = new FormData()
    const xmlBlob = new Blob([xmlRequest], { type: 'application/xml; charset=utf-8' })
    formData.append('action-szamla_agent_st', xmlBlob, 'storno.xml')

    const response = await fetch(SZAMLAZZ_API_URL, {
      method: 'POST',
      body: formData
    })

    const contentType = response.headers.get('content-type') || ''
    const isPdf = contentType.includes('application/pdf') || contentType.includes('pdf')
    const errorCode = response.headers.get('szlahu_error_code')
    const errorMessage = response.headers.get('szlahu_error')
    const stornoInvoiceNumber = response.headers.get('szlahu_szamlaszam')
    const responseText = await response.text()

    if (errorCode || errorMessage) {
      return NextResponse.json(
        { 
          error: `Szamlazz.hu hiba${errorCode ? ` (${errorCode})` : ''}: ${errorMessage || 'Ismeretlen hiba'}`,
          details: responseText.substring(0, 500)
        },
        { status: 400 }
      )
    }

    if (!stornoInvoiceNumber) {
      return NextResponse.json(
        { error: 'Sztornó számla szám nem található a válaszban', details: responseText.substring(0, 500) },
        { status: 400 }
      )
    }

    // Persist storno invoice record
    try {
      // Get sequential internal number
      let internalNumber: string | null = null
      try {
        const { data: internalRes, error: internalErr } = await supabaseAdmin
          .rpc('next_internal_invoice_number')
        if (!internalErr && internalRes) {
          internalNumber = internalRes as string
        }
      } catch (e) {
        console.warn('Internal number RPC failed; relying on DB default:', e)
      }

      const stornoInvoiceRow: any = {
        provider: 'szamlazz_hu',
        provider_invoice_number: stornoInvoiceNumber,
        provider_invoice_id: stornoInvoiceNumber,
        invoice_type: 'sztorno',
        related_order_type: invoice.related_order_type,
        related_order_id: invoice.related_order_id,
        related_order_number: invoice.related_order_number,
        customer_name: invoice.customer_name || '',
        customer_id: invoice.customer_id || null,
        payment_due_date: null,
        fulfillment_date: null,
        gross_total: invoice.gross_total ? -Math.abs(Number(invoice.gross_total)) : null,
        payment_status: 'nem_lesz_fizetve',
        is_storno_of_invoice_id: invoice.id,
        pdf_url: stornoInvoiceNumber
          ? `/api/invoices/pdf?number=${encodeURIComponent(stornoInvoiceNumber)}&provider=szamlazz_hu`
          : null
      }

      if (internalNumber) {
        stornoInvoiceRow.internal_number = internalNumber
      }

      const { data: insertedInvoice, error: insertError } = await supabaseAdmin
        .from('invoices')
        .insert([stornoInvoiceRow])
        .select()
        .single()

      if (insertError) {
        console.error('Failed to persist storno invoice:', insertError)
        return NextResponse.json(
          { error: 'Sztornó számla létrejött, de nem sikerült menteni az adatbázisba', details: insertError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        invoiceNumber: stornoInvoiceNumber,
        invoice: insertedInvoice,
        message: 'Sztornó számla sikeresen létrehozva'
      })
    } catch (persistError: any) {
      console.error('Failed to persist storno invoice:', persistError)
      return NextResponse.json(
        { error: 'Sztornó számla létrejött, de nem sikerült menteni az adatbázisba', details: persistError.message },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Error creating storno invoice:', error)
    return NextResponse.json(
      { error: error.message || 'Belső szerver hiba történt' },
      { status: 500 }
    )
  }
}

