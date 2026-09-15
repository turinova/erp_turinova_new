import { NextResponse } from 'next/server'

import { getSessionUser } from '@/lib/auth/session'
import type { PaymentStatus } from '@/lib/quotes/payment-labels'
import type { QuoteStatus } from '@/lib/quotes/queries'
import { normalizeScannerBarcode } from '@/lib/scanner/normalize-wedge'
import type { ScannerLookupOrder } from '@/lib/scanner/types'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type { ScannerLookupOrder }

/**
 * Staff-only: rendelés keresése vonalkód alapján (exact match, normalizálva).
 * Partner soha.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('barcode') ?? ''
  const barcode = normalizeScannerBarcode(raw)

  if (!barcode) {
    return NextResponse.json(
      { error: 'A vonalkód üres.' },
      { status: 400 }
    )
  }

  const staff = await getSessionUser()
  if (!staff?.tenantId || staff.isDevSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!staff.allowedPages.includes('/scanner')) {
    return NextResponse.json({ error: 'Nincs jogosultság.' }, { status: 403 })
  }

  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Nincs adatbázis kapcsolat.' },
      { status: 503 }
    )
  }

  const { data: quote, error } = await supabase
    .from('quotes')
    .select(
      `
      id,
      order_number,
      status,
      payment_status,
      total_gross,
      final_total_gross,
      currency,
      barcode,
      project_name,
      customers ( name )
    `
    )
    .eq('tenant_id', staff.tenantId)
    .eq('barcode', barcode)
    .is('deleted_at', null)
    .not('order_number', 'is', null)
    .maybeSingle()

  if (error) {
    console.error('scanner lookup', error.message)
    return NextResponse.json(
      { error: 'Nem sikerült a keresés.' },
      { status: 500 }
    )
  }

  if (!quote || !quote.order_number || !quote.barcode) {
    return NextResponse.json(
      { error: 'Nincs ilyen vonalkód.' },
      { status: 404 }
    )
  }

  const { data: payments, error: payError } = await supabase
    .from('quote_payments')
    .select('amount')
    .eq('quote_id', quote.id)
    .eq('tenant_id', staff.tenantId)
    .is('deleted_at', null)

  if (payError) {
    console.error('scanner lookup payments', payError.message)
  }

  const totalPaid = Math.round(
    ((payments ?? []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0) ||
      0) * 100
  ) / 100

  const customers = quote.customers as
    | { name: string }
    | { name: string }[]
    | null
  const customer = Array.isArray(customers) ? customers[0] : customers

  const body: ScannerLookupOrder = {
    id: quote.id,
    order_number: quote.order_number as string,
    status: quote.status as QuoteStatus,
    payment_status: (quote.payment_status ?? 'not_paid') as PaymentStatus,
    final_total_gross:
      Number(quote.final_total_gross ?? quote.total_gross) || 0,
    total_paid: totalPaid,
    currency: quote.currency ?? 'HUF',
    customer_name: customer?.name ?? '—',
    barcode: quote.barcode,
    project_name: (quote.project_name as string | null) ?? null
  }

  return NextResponse.json(body)
}
