import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/shipping-methods/[id]
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

    const { data, error } = await supabase
      .from('shipping_methods')
      .select('id, name, code, extension, icon_url, requires_pickup_point, supports_tracking, is_active, created_at, updated_at')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Szállítási mód nem található' },
        { status: 404 }
      )
    }

    return NextResponse.json({ shipping_method: data })
  } catch (error) {
    console.error('Error in shipping-methods GET [id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/shipping-methods/[id]
 */
export async function PUT(
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
    const {
      name,
      code,
      extension,
      icon_url,
      requires_pickup_point,
      supports_tracking,
      is_active
    } = body

    if (!name || !String(name).trim()) {
      return NextResponse.json(
        { error: 'A szállítási mód neve kötelező' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('shipping_methods')
      .update({
        name: String(name).trim(),
        code: code?.trim() || null,
        extension: extension?.trim() || null,
        icon_url: icon_url?.trim() || null,
        requires_pickup_point: requires_pickup_point === true,
        supports_tracking: supports_tracking !== false,
        is_active: is_active !== false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating shipping method:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a szállítási mód frissítésekor' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Szállítási mód nem található' },
        { status: 404 }
      )
    }

    return NextResponse.json({ shipping_method: data })
  } catch (error) {
    console.error('Error in shipping-methods PUT:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/shipping-methods/[id]
 * Soft delete (set deleted_at).
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

    const { error } = await supabase
      .from('shipping_methods')
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error('Error deleting shipping method:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a szállítási mód törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in shipping-methods DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
