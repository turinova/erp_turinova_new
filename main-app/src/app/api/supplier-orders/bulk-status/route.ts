import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { item_ids, new_status } = body

    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
      return NextResponse.json({ error: 'No items selected' }, { status: 400 })
    }

    if (!new_status) {
      return NextResponse.json({ error: 'No status provided' }, { status: 400 })
    }

    // Validate status
    const validStatuses = ['open', 'ordered', 'arrived', 'deleted']
    if (!validStatuses.includes(new_status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    console.log(`[BULK STATUS] Updating ${item_ids.length} items to status: ${new_status}`)

    const startTime = performance.now()

    // Update all selected items
    const { data, error } = await supabaseServer
      .from('shop_order_items')
      .update({ 
        status: new_status,
        updated_at: new Date().toISOString()
      })
      .in('id', item_ids)
      .select('id, status')

    const queryTime = performance.now() - startTime

    if (error) {
      console.error('Error updating shop order items:', error)
      return NextResponse.json({ error: 'Failed to update items' }, { status: 500 })
    }

    console.log(`[PERF] Bulk Status Update: ${queryTime.toFixed(2)}ms (Updated ${data?.length || 0} items)`)

    return NextResponse.json({
      success: true,
      updated_count: data?.length || 0,
      new_status
    })

  } catch (error) {
    console.error('Error in bulk status update API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
