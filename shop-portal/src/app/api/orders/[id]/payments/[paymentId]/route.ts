import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  try {
    const { id: orderId, paymentId } = await params
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
    if (!reason) {
      return NextResponse.json({ error: 'A törlés indoka kötelező.' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('order_payments')
      .select('id, reference_number, notes')
      .eq('id', paymentId)
      .eq('order_id', orderId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'Fizetési tétel nem található.' }, { status: 404 })
    }
    if (existing.reference_number === 'import_auto_paid') {
      return NextResponse.json(
        { error: 'Automatikus import fizetési tétel nem törölhető kézzel.' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    const appendedNote = [existing.notes, `[TÖRÖLVE] ${reason}`].filter(Boolean).join(' | ')
    const { data, error } = await supabase
      .from('order_payments')
      .update({ deleted_at: now, notes: appendedNote })
      .eq('id', paymentId)
      .eq('order_id', orderId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (!data) {
      return NextResponse.json({ error: 'Fizetési tétel nem található.' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in order payment DELETE API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
