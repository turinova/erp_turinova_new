import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/pack/orders
 * List orders ready for packing (status picked or packing). For Csomagolás queue page.
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
        customer_email,
        shipping_firstname,
        shipping_lastname,
        shipping_company,
        shipping_city,
        shipping_postcode,
        shipping_address1,
        shipping_method_id,
        shipping_method_name,
        updated_at
      `)
      .in('status', ['picked', 'packing'])
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Pack orders list error:', error)
      return NextResponse.json({ error: 'Hiba a lista betöltésekor' }, { status: 500 })
    }

    return NextResponse.json({ orders: orders || [] })
  } catch (err) {
    console.error('Error in pack/orders GET:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
