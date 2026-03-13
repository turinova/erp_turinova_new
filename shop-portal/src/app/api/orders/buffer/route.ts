import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/orders/buffer
 * List pending orders in buffer (for review page)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'pending'
    const connectionId = searchParams.get('connection_id')
    const dateFrom = searchParams.get('date_from') || ''
    const dateTo = searchParams.get('date_to') || ''
    const shippingMethod = searchParams.get('shipping_method') || ''
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50') || 50)
    const pageParam = searchParams.get('page')
    const offsetParam = searchParams.get('offset')
    const offset = pageParam
      ? (Math.max(1, parseInt(pageParam) || 1) - 1) * limit
      : parseInt(offsetParam || '0')

    // Build query (fetch more when we need to filter by shipping in memory)
    let query = supabase
      .from('order_buffer')
      .select(`
        id,
        connection_id,
        platform_order_id,
        platform_order_resource_id,
        status,
        is_blacklisted,
        blacklist_reason,
        received_at,
        created_at,
        updated_at,
        webhook_data,
        webshop_connections!order_buffer_connection_id_fkey (
          id,
          name,
          api_url
        )
      `)
      .eq('status', status)
      .order('received_at', { ascending: false })

    if (connectionId) {
      query = query.eq('connection_id', connectionId)
    }
    if (dateFrom) {
      const from = new Date(dateFrom)
      if (!isNaN(from.getTime())) query = query.gte('received_at', from.toISOString())
    }
    if (dateTo) {
      const to = new Date(dateTo)
      if (!isNaN(to.getTime())) query = query.lte('received_at', to.toISOString())
    }

    // Fetch up to 1000 when filtering by shipping (we filter in memory)
    const fetchLimit = shippingMethod ? 1000 : limit
    const fetchOffset = shippingMethod ? 0 : offset
    const { data: bufferEntriesRaw, error } = await query.range(fetchOffset, fetchOffset + (shippingMethod ? 999 : limit - 1))

    if (error) {
      console.error('[BUFFER] Error fetching buffer entries:', error)
      return NextResponse.json(
        { error: 'Failed to fetch buffer entries', details: error.message },
        { status: 500 }
      )
    }

    let bufferEntries = bufferEntriesRaw || []

    const getProductCount = (od: any) => {
      const raw = od?.orderProducts
      if (!raw) return 0
      if (Array.isArray(raw)) return raw.length
      const inner = raw.orderProduct
      return inner == null ? 0 : Array.isArray(inner) ? inner.length : 1
    }
    // Extract order data from webhook_data for display
    let enrichedEntries = (bufferEntries as any[]).map((entry: any) => {
      const webhookData = entry.webhook_data as any
      const orderData = webhookData?.orders?.order?.[0] || webhookData?.order || webhookData

      return {
        id: entry.id,
        connection_id: entry.connection_id,
        platform_order_id: entry.platform_order_id,
        platform_order_resource_id: entry.platform_order_resource_id,
        status: entry.status,
        is_blacklisted: entry.is_blacklisted,
        blacklist_reason: entry.blacklist_reason,
        received_at: entry.received_at,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
        connection: entry.webshop_connections,
        order_summary: {
          customer_name: orderData?.firstname && orderData?.lastname
            ? `${orderData.firstname} ${orderData.lastname}`
            : null,
          customer_email: orderData?.email || null,
          total: orderData?.totalGross || orderData?.total || null,
          currency: orderData?.currency?.code || orderData?.currency || 'HUF',
          date_created: orderData?.dateCreated || null,
          order_status: orderData?.orderStatus?.name || orderData?.orderHistory?.statusText || null,
          payment_method_name: orderData?.paymentMethodName || null,
          shipping_method_name: orderData?.shippingMethodName || null,
          product_count: getProductCount(orderData)
        }
      }
    })

    if (shippingMethod) {
      enrichedEntries = enrichedEntries.filter(e => (e.order_summary.shipping_method_name || '').trim() === shippingMethod)
    }

    const total = enrichedEntries.length
    const paginatedEntries = shippingMethod ? enrichedEntries.slice(offset, offset + limit) : enrichedEntries

    return NextResponse.json({
      success: true,
      entries: paginatedEntries,
      pagination: {
        total,
        limit,
        offset,
        has_more: total > offset + limit
      }
    })

  } catch (error) {
    console.error('[BUFFER] Unexpected error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/orders/buffer
 * Bulk delete buffer entries (for cleanup)
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Buffer entry IDs required' },
        { status: 400 }
      )
    }

    // Delete buffer entries
    const { data, error } = await supabase
      .from('order_buffer')
      .delete()
      .in('id', ids)
      .select('id')

    if (error) {
      console.error('[BUFFER] Error deleting entries:', error)
      return NextResponse.json(
        { error: 'Failed to delete buffer entries', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      deleted_count: data?.length || 0,
      deleted_ids: data?.map(d => d.id) || []
    })

  } catch (error) {
    console.error('[BUFFER] Unexpected error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
