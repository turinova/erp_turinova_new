import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/dispatch/pickup
 * List orders ready for pickup (status ready_for_pickup). Optional ?q= search (order_number, customer name).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim() || ''

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
      .eq('status', 'ready_for_pickup')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(100)

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
