import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getSzamlazzConnectionForOrder } from '@/lib/shop-szamlazz-connection'
import { fetchSzamlazzInvoicePdf } from '@/lib/szamlazz-fetch-invoice-pdf'

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

    const result = await fetchSzamlazzInvoicePdf(connection, invoiceNumber)
    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          details: result.details
        },
        { status: result.status >= 400 && result.status < 600 ? result.status : 502 }
      )
    }

    return NextResponse.json({
      success: true,
      pdf: result.pdf.toString('base64'),
      mimeType: 'application/pdf'
    })
  } catch (e) {
    console.error('query-invoice-pdf', e)
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Belső hiba' },
      { status: 500 }
    )
  }
}
