import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// POST /api/customer-orders/[id]/payments - Add new payment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { payment_type, amount } = body

    if (!payment_type || !amount) {
      return NextResponse.json({ error: 'Fizetési mód és összeg kötelező' }, { status: 400 })
    }

    if (payment_type !== 'cash' && payment_type !== 'card') {
      return NextResponse.json({ error: 'Érvénytelen fizetési mód' }, { status: 400 })
    }

    if (amount <= 0) {
      return NextResponse.json({ error: 'Az összegnek nagyobbnak kell lennie, mint 0' }, { status: 400 })
    }

    // Insert new payment
    const { data: payment, error } = await supabaseServer
      .from('customer_order_payments')
      .insert({
        customer_order_id: id,
        payment_type: payment_type,
        amount: amount,
        status: 'completed'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating payment:', error)
      return NextResponse.json({ error: 'Hiba a fizetés létrehozásakor' }, { status: 500 })
    }

    return NextResponse.json({ payment })
  } catch (error) {
    console.error('Error in POST /api/customer-orders/[id]/payments', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

