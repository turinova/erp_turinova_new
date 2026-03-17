import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * DELETE /api/pick-batches/[id]/orders/[orderId]
 * Remove an order from a batch. Only when batch is draft.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const { id, orderId } = await params
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: batch, error: batchError } = await supabase
      .from('pick_batches')
      .select('id, status')
      .eq('id', id)
      .single()

    if (batchError || !batch) {
      return NextResponse.json(
        { error: 'Begyűjtés nem található' },
        { status: 404 }
      )
    }

    if (batch.status !== 'draft') {
      return NextResponse.json(
        { error: 'Csak piszkozat begyűjtésből távolítható el rendelés' },
        { status: 400 }
      )
    }

    const { error: deleteError } = await supabase
      .from('pick_batch_orders')
      .delete()
      .eq('pick_batch_id', id)
      .eq('order_id', orderId)

    if (deleteError) {
      console.error('Error removing order from batch:', deleteError)
      return NextResponse.json(
        { error: deleteError.message || 'Hiba a rendelés eltávolításakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ removed: true })
  } catch (err) {
    console.error('Error in pick-batches [id]/orders [orderId] DELETE:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
