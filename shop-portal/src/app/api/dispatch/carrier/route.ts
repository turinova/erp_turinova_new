import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

const RECENT_HOURS = 48
const RECENT_LIMIT = 100

/**
 * GET /api/dispatch/carrier
 * scope=queue (default): awaiting_carrier — futárnak átadandó sor.
 * scope=recent_shipped: shipped, updated in last 48h — legutóbb futárnak átadott (ellenőrzés).
 * Optional q=: ilike search on order_number, names, company, email, tracking_number, shipping_method_name.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const scope = searchParams.get('scope') || 'queue'
    const q = searchParams.get('q')?.trim() || ''
    const sinceIso = new Date(Date.now() - RECENT_HOURS * 60 * 60 * 1000).toISOString()

    let query = supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        tracking_number,
        customer_email,
        shipping_firstname,
        shipping_lastname,
        shipping_company,
        shipping_city,
        shipping_address1,
        shipping_method_name,
        order_date,
        shipped_at,
        updated_at
      `)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })

    if (scope === 'recent_shipped') {
      query = query.eq('status', 'shipped').gte('updated_at', sinceIso).limit(RECENT_LIMIT)
    } else {
      query = query.eq('status', 'awaiting_carrier')
    }

    if (q) {
      query = query.or(
        `order_number.ilike.%${q}%,shipping_firstname.ilike.%${q}%,shipping_lastname.ilike.%${q}%,shipping_company.ilike.%${q}%,customer_email.ilike.%${q}%,tracking_number.ilike.%${q}%,shipping_method_name.ilike.%${q}%`
      )
    }

    const { data: orders, error } = await query

    if (error) {
      console.error('Dispatch carrier list error:', error)
      return NextResponse.json({ error: 'Hiba a lista betöltésekor' }, { status: 500 })
    }

    return NextResponse.json({ orders: orders || [] })
  } catch (err) {
    console.error('Error in dispatch/carrier GET:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
