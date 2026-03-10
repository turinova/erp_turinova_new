import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/suppliers/[id]/order-channels
 * Fetch all order channels for a supplier
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

    const { data: orderChannels, error } = await supabase
      .from('supplier_order_channels')
      .select('*')
      .eq('supplier_id', id)
      .is('deleted_at', null)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching order channels:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a rendelési csatornák lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ order_channels: orderChannels || [] })
  } catch (error) {
    console.error('Error in order-channels GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/suppliers/[id]/order-channels
 * Create a new order channel for a supplier
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

    const body = await request.json()
    const { channel_type, name, url_template, description, is_default } = body

    // Validation
    if (!channel_type) {
      return NextResponse.json(
        { error: 'A rendelési csatorna típusa kötelező' },
        { status: 400 }
      )
    }

    // If internet type, url_template is required
    if (channel_type === 'internet' && !url_template?.trim()) {
      return NextResponse.json(
        { error: 'Az internetes rendeléshez URL sablon kötelező' },
        { status: 400 }
      )
    }

    // If this is set as default, unset other defaults
    if (is_default) {
      await supabase
        .from('supplier_order_channels')
        .update({ is_default: false })
        .eq('supplier_id', id)
        .is('deleted_at', null)
    }

    const { data, error } = await supabase
      .from('supplier_order_channels')
      .insert({
        supplier_id: id,
        channel_type,
        name: name?.trim() || null,
        url_template: url_template?.trim() || null,
        description: description?.trim() || null,
        is_default: is_default || false
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating order channel:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a rendelési csatorna létrehozásakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ order_channel: data }, { status: 201 })
  } catch (error) {
    console.error('Error in order-channels POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
