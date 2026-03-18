import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/shipping-methods
 * Fetch all shipping methods (active and inactive for list; filter by is_active if needed).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('shipping_methods')
      .select('id, name, code, extension, requires_pickup_point, supports_tracking, is_active, carrier_provider, customer_code, api_username, created_at, updated_at')
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching shipping methods:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a szállítási módok lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ shipping_methods: data || [] })
  } catch (error) {
    console.error('Error in shipping-methods GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/shipping-methods
 * Create a new shipping method.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      code,
      extension,
      icon_url,
      requires_pickup_point,
      supports_tracking,
      is_active,
      carrier_provider,
      customer_code,
      api_username,
      api_password
    } = body

    if (!name || !String(name).trim()) {
      return NextResponse.json(
        { error: 'A szállítási mód neve kötelező' },
        { status: 400 }
      )
    }

    const insert: Record<string, unknown> = {
      name: String(name).trim(),
      code: code?.trim() || null,
      extension: extension?.trim() || null,
      icon_url: icon_url?.trim() || null,
      requires_pickup_point: requires_pickup_point === true,
      supports_tracking: supports_tracking !== false,
      is_active: is_active !== false,
      carrier_provider: carrier_provider?.trim() || null,
      customer_code: customer_code?.trim() || null,
      api_username: api_username?.trim() || null
    }
    if (api_password != null && String(api_password).trim() !== '') {
      insert.api_password = String(api_password).trim()
    }

    const { data, error } = await supabase
      .from('shipping_methods')
      .insert(insert)
      .select('id, name, code, extension, icon_url, requires_pickup_point, supports_tracking, is_active, carrier_provider, customer_code, api_username, created_at, updated_at')
      .single()

    if (error) {
      console.error('Error creating shipping method:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a szállítási mód létrehozásakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ shipping_method: data }, { status: 201 })
  } catch (error) {
    console.error('Error in shipping-methods POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
