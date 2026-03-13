import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getConnectionById } from '@/lib/connections-server'

/**
 * GET /api/connections/[id]/shipping-method-mappings
 * Returns ERP shipping methods and current mappings for this connection.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const connection = await getConnectionById(id, supabase)
    if (!connection) {
      return NextResponse.json({ error: 'Invalid connection' }, { status: 400 })
    }

    const { data: shippingMethods, error: smError } = await supabase
      .from('shipping_methods')
      .select('id, name, code, extension, is_active')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (smError) {
      console.error('Error fetching shipping methods:', smError)
      return NextResponse.json(
        { error: 'Hiba a szállítási módok lekérdezésekor' },
        { status: 500 }
      )
    }

    const { data: mappings, error: mappingError } = await supabase
      .from('connection_shipping_method_mappings')
      .select('shipping_method_id, platform_shipping_code, platform_shipping_name')
      .eq('connection_id', id)

    if (mappingError) {
      console.error('Error fetching shipping mappings:', mappingError)
      return NextResponse.json(
        { error: 'Hiba a szállítási mód leképezések lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      shippingMethods: shippingMethods || [],
      mappings: mappings || []
    })
  } catch (error) {
    console.error('Error in shipping-method-mappings GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/connections/[id]/shipping-method-mappings
 * Create or update a shipping method mapping (upsert by connection_id + platform_shipping_code).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const connection = await getConnectionById(id, supabase)
    if (!connection) {
      return NextResponse.json({ error: 'Invalid connection' }, { status: 400 })
    }

    const body = await request.json()
    const { shipping_method_id, platform_shipping_code, platform_shipping_name } = body

    if (!shipping_method_id || !platform_shipping_code || !String(platform_shipping_code).trim()) {
      return NextResponse.json(
        { error: 'shipping_method_id és platform_shipping_code megadása kötelező' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('connection_shipping_method_mappings')
      .upsert(
        {
          connection_id: id,
          shipping_method_id,
          platform_shipping_code: String(platform_shipping_code).trim(),
          platform_shipping_name: platform_shipping_name?.trim() || null,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'connection_id,platform_shipping_code' }
      )
      .select()
      .single()

    if (error) {
      console.error('Error saving shipping mapping:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a leképezés mentésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ mapping: data })
  } catch (error) {
    console.error('Error in shipping-method-mappings POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/connections/[id]/shipping-method-mappings?shipping_method_id=... or ?platform_shipping_code=...
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const shipping_method_id = searchParams.get('shipping_method_id')
    const platform_shipping_code = searchParams.get('platform_shipping_code')

    if (!shipping_method_id && !platform_shipping_code) {
      return NextResponse.json(
        { error: 'shipping_method_id vagy platform_shipping_code megadása kötelező' },
        { status: 400 }
      )
    }

    let q = supabase
      .from('connection_shipping_method_mappings')
      .delete()
      .eq('connection_id', id)

    if (shipping_method_id) q = q.eq('shipping_method_id', shipping_method_id)
    if (platform_shipping_code) q = q.eq('platform_shipping_code', platform_shipping_code)

    const { error } = await q

    if (error) {
      console.error('Error deleting shipping mapping:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a leképezés törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in shipping-method-mappings DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
