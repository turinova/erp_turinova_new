import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

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
      .from('order_payments')
      .select('id, order_id, amount, payment_method_id, payment_method_name, payment_date, transaction_id, reference_number, notes, created_by, created_at')
      .eq('order_id', orderId)
      .is('deleted_at', null)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ payments: data || [] })
  } catch (error) {
    console.error('Error in order payments GET API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const amountRaw = Number(body?.amount)
    const paymentMethodId = body?.payment_method_id ? String(body.payment_method_id) : null
    const paymentDate = body?.payment_date ? String(body.payment_date) : null
    const transactionId = body?.transaction_id ? String(body.transaction_id).trim() : null
    const referenceNumber = body?.reference_number ? String(body.reference_number).trim() : null
    const notes = body?.notes ? String(body.notes).trim() : null

    if (!Number.isFinite(amountRaw) || amountRaw === 0) {
      return NextResponse.json({ error: 'Az összeg kötelező és nem lehet 0.' }, { status: 400 })
    }
    if (amountRaw < 0 && !notes) {
      return NextResponse.json({ error: 'Visszatérítésnél megjegyzés kötelező.' }, { status: 400 })
    }

    const { data: orderExists } = await supabase
      .from('orders')
      .select('id')
      .eq('id', orderId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!orderExists) {
      return NextResponse.json({ error: 'Rendelés nem található.' }, { status: 404 })
    }

    let paymentMethodName: string | null = null
    if (paymentMethodId) {
      const { data: method } = await supabase
        .from('payment_methods')
        .select('id, name')
        .eq('id', paymentMethodId)
        .is('deleted_at', null)
        .maybeSingle()
      if (!method) {
        return NextResponse.json({ error: 'Érvénytelen fizetési mód.' }, { status: 400 })
      }
      paymentMethodName = method.name
    }

    const { data, error } = await supabase
      .from('order_payments')
      .insert({
        order_id: orderId,
        amount: amountRaw,
        payment_method_id: paymentMethodId,
        payment_method_name: paymentMethodName,
        payment_date: paymentDate || new Date().toISOString(),
        transaction_id: transactionId,
        reference_number: referenceNumber,
        notes,
        created_by: user.id
      })
      .select('id, order_id, amount, payment_method_id, payment_method_name, payment_date, transaction_id, reference_number, notes, created_by, created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ payment: data }, { status: 201 })
  } catch (error) {
    console.error('Error in order payments POST API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
