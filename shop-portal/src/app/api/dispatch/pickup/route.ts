import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

const RECENT_HOURS = 48
const RECENT_LIMIT = 100

/**
 * GET /api/dispatch/pickup
 * scope=queue (default): ready_for_pickup — személyes átvételre váró sor.
 * scope=recent_delivered: delivered, updated in last 48h — legutóbb átvett (ellenőrzés).
 * Optional q=: ilike search (order_number, name, company, email).
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
        customer_email,
        shipping_firstname,
        shipping_lastname,
        shipping_company,
        shipping_city,
        shipping_address1,
        updated_at
      `)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })

    if (scope === 'recent_delivered') {
      query = query.eq('status', 'delivered').gte('updated_at', sinceIso).limit(RECENT_LIMIT)
    } else {
      query = query.eq('status', 'ready_for_pickup')
    }

    if (q) {
      query = query.or(
        `order_number.ilike.%${q}%,shipping_firstname.ilike.%${q}%,shipping_lastname.ilike.%${q}%,shipping_company.ilike.%${q}%,customer_email.ilike.%${q}%`
      )
    }

    const { data: orders, error } = await query

    if (error) {
      console.error('Dispatch pickup list error:', error)
      return NextResponse.json({ error: 'Hiba a lista betöltésekor' }, { status: 500 })
    }

    return NextResponse.json({ orders: orders || [] })
  } catch (err) {
    console.error('Error in dispatch/pickup GET:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
