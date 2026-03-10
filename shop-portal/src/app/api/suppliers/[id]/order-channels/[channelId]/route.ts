import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * PUT /api/suppliers/[id]/order-channels/[channelId]
 * Update an order channel
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; channelId: string }> }
) {
  try {
    const { id, channelId } = await params
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
        .neq('id', channelId)
        .is('deleted_at', null)
    }

    const { data, error } = await supabase
      .from('supplier_order_channels')
      .update({
        channel_type,
        name: name?.trim() || null,
        url_template: url_template?.trim() || null,
        description: description?.trim() || null,
        is_default: is_default || false,
        updated_at: new Date().toISOString()
      })
      .eq('id', channelId)
      .select()
      .single()

    if (error) {
      console.error('Error updating order channel:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a rendelési csatorna frissítésekor' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Rendelési csatorna nem található' },
        { status: 404 }
      )
    }

    return NextResponse.json({ order_channel: data })
  } catch (error) {
    console.error('Error in order-channels PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/suppliers/[id]/order-channels/[channelId]
 * Soft delete an order channel
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; channelId: string }> }
) {
  try {
    const { channelId } = await params
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('supplier_order_channels')
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq('id', channelId)

    if (error) {
      console.error('Error deleting order channel:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a rendelési csatorna törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in order-channels DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
