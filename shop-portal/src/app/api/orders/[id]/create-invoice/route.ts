import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { createShopInvoiceInternal } from '@/lib/shop-create-invoice-internal'

/**
 * POST /api/orders/[id]/create-invoice — Számlázz Agent (normál / előleg / díjbekérő / végszámla)
 */
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

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    const result = await createShopInvoiceInternal(supabase, orderId, body)

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: result.status }
      )
    }

    return NextResponse.json({
      success: true,
      invoiceNumber: result.invoiceNumber,
      invoice: result.invoice
    })
  } catch (e) {
    console.error('create-invoice', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Belső hiba' },
      { status: 500 }
    )
  }
}
