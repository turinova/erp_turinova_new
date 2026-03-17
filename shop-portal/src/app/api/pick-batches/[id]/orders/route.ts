import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * POST /api/pick-batches/[id]/orders
 * Add orders to a batch. Body: { order_ids: string[] }
 * Orders must be: status new, fulfillability_status fully_fulfillable, not in another draft/in_progress batch.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const orderIds = Array.isArray(body?.order_ids) ? body.order_ids : []
    if (orderIds.length === 0) {
      return NextResponse.json(
        { error: 'Legalább egy rendelés szükséges' },
        { status: 400 }
      )
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
        { error: 'Csak piszkozat begyűjtéshez adhat hozzá rendelést' },
        { status: 400 }
      )
    }

    const { data: orders } = await supabase
      .from('orders')
      .select('id, status, fulfillability_status')
      .in('id', orderIds)
      .is('deleted_at', null)

    const foundIds = new Set((orders || []).map((o: any) => o.id))
    const invalid = orderIds.filter((oid) => !foundIds.has(oid))
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Nem található vagy törölt rendelés: ${invalid.join(', ')}` },
        { status: 400 }
      )
    }

    const notNew = (orders || []).filter((o: any) => o.status !== 'new')
    if (notNew.length > 0) {
      return NextResponse.json(
        { error: 'Csak Új státuszú rendelések adhatók hozzá' },
        { status: 400 }
      )
    }

    const notFulfillable = (orders || []).filter((o: any) => o.fulfillability_status !== 'fully_fulfillable')
    if (notFulfillable.length > 0) {
      return NextResponse.json(
        { error: 'Csak Csomagolható rendelések adhatók hozzá' },
        { status: 400 }
      )
    }

    const { data: existing } = await supabase
      .from('pick_batch_orders')
      .select('order_id, pick_batch_id')
      .in('order_id', orderIds)

    const otherBatchIds = [...new Set((existing || []).filter((r: any) => r.pick_batch_id !== id).map((r: any) => r.pick_batch_id))]
    if (otherBatchIds.length > 0) {
      const { data: otherBatches } = await supabase
        .from('pick_batches')
        .select('id')
        .in('id', otherBatchIds)
        .in('status', ['draft', 'in_progress'])
      const activeOther = new Set((otherBatches || []).map((b: any) => b.id))
      const inOtherActiveBatch = (existing || []).filter((r: any) => activeOther.has(r.pick_batch_id))
      if (inOtherActiveBatch.length > 0) {
        const ids = inOtherActiveBatch.map((r: any) => r.order_id)
        return NextResponse.json(
          { error: `Egy vagy több rendelés már másik aktív begyűjtésben van` },
          { status: 400 }
        )
      }
    }

    const toInsert = orderIds.map((order_id) => ({ pick_batch_id: id, order_id }))
    const { data: inserted, error: insertError } = await supabase
      .from('pick_batch_orders')
      .upsert(toInsert, { onConflict: 'pick_batch_id,order_id', ignoreDuplicates: true })
      .select('id, order_id')

    if (insertError) {
      console.error('Error adding orders to batch:', insertError)
      return NextResponse.json(
        { error: insertError.message || 'Hiba a rendelések hozzáadásakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      added: inserted?.length ?? orderIds.length,
      pick_batch_orders: inserted || []
    })
  } catch (err) {
    console.error('Error in pick-batches [id]/orders POST:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
