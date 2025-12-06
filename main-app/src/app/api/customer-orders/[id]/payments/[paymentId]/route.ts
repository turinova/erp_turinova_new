import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// DELETE /api/customer-orders/[id]/payments/[paymentId] - Soft delete payment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  try {
    const { id, paymentId } = await params

    // Check if payment exists and belongs to this order
    const { data: payment, error: fetchError } = await supabaseServer
      .from('customer_order_payments')
      .select('id, deleted_at')
      .eq('id', paymentId)
      .eq('customer_order_id', id)
      .single()

    if (fetchError || !payment) {
      return NextResponse.json({ error: 'Fizetés nem található' }, { status: 404 })
    }

    // If already soft-deleted, return success (idempotent)
    if (payment.deleted_at) {
      return NextResponse.json({ message: 'Fizetés már törölve' })
    }

    // Soft delete
    const { error: deleteError } = await supabaseServer
      .from('customer_order_payments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', paymentId)

    if (deleteError) {
      console.error('Error soft deleting payment:', deleteError)
      return NextResponse.json({ error: 'Hiba a fizetés törlésekor' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Fizetés törölve' })
  } catch (error) {
    console.error('Error in DELETE /api/customer-orders/[id]/payments/[paymentId]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

