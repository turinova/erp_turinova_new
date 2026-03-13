import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/orders/buffer/[id]
 * Get a single buffer entry with full webhook data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: bufferEntry, error } = await supabase
      .from('order_buffer')
      .select(`
        *,
        webshop_connections:connection_id (
          id,
          name,
          api_url,
          connection_type
        )
      `)
      .eq('id', id)
      .single()

    if (error || !bufferEntry) {
      return NextResponse.json(
        { error: 'Buffer entry not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      entry: bufferEntry
    })

  } catch (error) {
    console.error('[BUFFER] Unexpected error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/orders/buffer/[id]
 * Update buffer entry (blacklist, notes, etc.)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { is_blacklisted, blacklist_reason, status } = body

    // Build update object
    const updates: any = {
      updated_at: new Date().toISOString()
    }

    if (is_blacklisted !== undefined) {
      updates.is_blacklisted = is_blacklisted
      if (is_blacklisted && blacklist_reason) {
        updates.blacklist_reason = blacklist_reason
      } else if (!is_blacklisted) {
        updates.blacklist_reason = null
      }
    }

    if (status) {
      updates.status = status
    }

    const { data: updatedEntry, error } = await supabase
      .from('order_buffer')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[BUFFER] Error updating entry:', error)
      return NextResponse.json(
        { error: 'Failed to update buffer entry', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      entry: updatedEntry
    })

  } catch (error) {
    console.error('[BUFFER] Unexpected error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/orders/buffer/[id]
 * Delete a single buffer entry
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('order_buffer')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[BUFFER] Error deleting entry:', error)
      return NextResponse.json(
        { error: 'Failed to delete buffer entry', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Buffer entry deleted'
    })

  } catch (error) {
    console.error('[BUFFER] Unexpected error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
