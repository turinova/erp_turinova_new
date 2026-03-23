import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

const RELATED_ORDER_TYPE = 'order' as const

/**
 * GET /api/orders/[id]/invoices — invoices linked to this shop order
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('invoices')
      .select(
        'id, internal_number, provider_invoice_number, invoice_type, gross_total, payment_status, pdf_url, connection_id, created_at, payment_due_date, fulfillment_date, is_storno_of_invoice_id'
      )
      .eq('related_order_type', RELATED_ORDER_TYPE)
      .eq('related_order_id', orderId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('invoices list error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ invoices: data ?? [] })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
