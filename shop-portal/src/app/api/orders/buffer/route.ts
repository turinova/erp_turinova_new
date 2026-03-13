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
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    // Note: Using explicit join syntax since PostgREST needs the foreign key to be recognized
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
      .range(offset, offset + limit - 1)

    // Filter by connection if provided
    if (connectionId) {
      query = query.eq('connection_id', connectionId)
    }

    const { data: bufferEntries, error } = await query

    if (error) {
      console.error('[BUFFER] Error fetching buffer entries:', error)
      return NextResponse.json(
        { error: 'Failed to fetch buffer entries', details: error.message },
        { status: 500 }
      )
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('order_buffer')
      .select('id', { count: 'exact', head: true })
      .eq('status', status)

    if (connectionId) {
      countQuery = countQuery.eq('connection_id', connectionId)
    }

    const { count, error: countError } = await countQuery

    // Extract order data from webhook_data for display
    const enrichedEntries = bufferEntries?.map((entry: any) => {
      const webhookData = entry.webhook_data as any
      // Handle different webhook formats
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
        // Extract order summary from webhook_data
        order_summary: {
          customer_name: orderData?.firstname && orderData?.lastname
            ? `${orderData.firstname} ${orderData.lastname}`
            : null,
          customer_email: orderData?.email || null,
          total: orderData?.totalGross || orderData?.total || null,
          currency: orderData?.currency?.code || orderData?.currency || 'HUF',
          date_created: orderData?.dateCreated || null,
          order_status: orderData?.orderStatus?.name || orderData?.orderHistory?.statusText || null
        }
      }
    }) || []

    return NextResponse.json({
      success: true,
      entries: enrichedEntries,
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit
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
