import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/orders/buffer/filters
 * Returns distinct shipping method names for buffer (for dropdown)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'pending'
    const connectionId = searchParams.get('connection_id')
    const dateFrom = searchParams.get('date_from') || ''
    const dateTo = searchParams.get('date_to') || ''

    let query = supabase
      .from('order_buffer')
      .select('webhook_data')
      .eq('status', status)
      .order('received_at', { ascending: false })
      .limit(2000)

    if (connectionId) query = query.eq('connection_id', connectionId)
    if (dateFrom) {
      const from = new Date(dateFrom)
      if (!isNaN(from.getTime())) query = query.gte('received_at', from.toISOString())
    }
    if (dateTo) {
      const to = new Date(dateTo)
      if (!isNaN(to.getTime())) query = query.lte('received_at', to.toISOString())
    }

    const { data: rows, error } = await query
    if (error) {
      console.error('[BUFFER FILTERS]', error)
      return NextResponse.json({ error: 'Failed to fetch filters', details: error.message }, { status: 500 })
    }

    const names = new Set<string>()
    ;(rows || []).forEach((row: any) => {
      const w = row.webhook_data
      const order = w?.orders?.order?.[0] || w?.order || w
      const name = order?.shippingMethodName
      if (name != null && String(name).trim()) names.add(String(name).trim())
    })

    return NextResponse.json({ shipping_methods: Array.from(names).sort() })
  } catch (e) {
    console.error('[BUFFER FILTERS]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
