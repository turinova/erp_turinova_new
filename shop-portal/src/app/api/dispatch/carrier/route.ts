import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/dispatch/carrier
 * List orders awaiting handover to carrier (status awaiting_carrier).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        tracking_number,
        shipping_firstname,
        shipping_lastname,
        shipping_company,
        shipping_city,
        shipping_address1,
        shipping_method_name,
        updated_at
      `)
      .eq('status', 'awaiting_carrier')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(100)

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
