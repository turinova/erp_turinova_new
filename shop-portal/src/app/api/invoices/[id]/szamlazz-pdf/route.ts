import { NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getSzamlazzConnectionById, getSzamlazzConnectionForOrder } from '@/lib/shop-szamlazz-connection'
import { fetchSzamlazzInvoicePdf } from '@/lib/szamlazz-fetch-invoice-pdf'

const PROVIDER = 'szamlazz_hu'

/**
 * Stream PDF from Számlázz.hu Agent on demand (no Supabase Storage).
 * Link from Kimenő számlák: `/api/invoices/[id]/szamlazz-pdf`
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: invoiceId } = await params
    const supabase = await getTenantSupabase()
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: inv, error: invErr } = await supabase
      .from('invoices')
      .select('id, provider, provider_invoice_number, connection_id, related_order_id, internal_number')
      .eq('id', invoiceId)
      .is('deleted_at', null)
      .maybeSingle()

    if (invErr || !inv) {
      return NextResponse.json({ error: 'Bizonylat nem található' }, { status: 404 })
    }

    if (inv.provider !== PROVIDER || !String(inv.provider_invoice_number || '').trim()) {
      return NextResponse.json(
        { error: 'Csak Számlázz.hu bizonylathoz érhető el PDF (hiányzó szolgáltatói szám)' },
        { status: 400 }
      )
    }

    let connection = null
    if (inv.connection_id) {
      connection = await getSzamlazzConnectionById(supabase, inv.connection_id)
    }
    if (!connection && inv.related_order_id) {
      const { data: order } = await supabase
        .from('orders')
        .select('connection_id')
        .eq('id', inv.related_order_id)
        .is('deleted_at', null)
        .maybeSingle()
      connection = await getSzamlazzConnectionForOrder(supabase, order ?? { connection_id: null })
    }

    if (!connection?.password) {
      return NextResponse.json({ error: 'Nincs Számlázz Agent kapcsolat a PDF lekéréshez' }, { status: 400 })
    }

    const result = await fetchSzamlazzInvoicePdf(connection, String(inv.provider_invoice_number))
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: result.status >= 400 && result.status < 600 ? result.status : 502 }
      )
    }

    const safeName = String(inv.internal_number || inv.id).replace(/[^\w.-]+/g, '_')
    return new NextResponse(new Uint8Array(result.pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="szamlazz-${safeName}.pdf"`,
        'Cache-Control': 'private, max-age=300'
      }
    })
  } catch (e) {
    console.error('szamlazz-pdf GET', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Belső hiba' },
      { status: 500 }
    )
  }
}
