import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const name = String(body.name || '').trim()
    if (!name) return NextResponse.json({ error: 'Név kötelező' }, { status: 400 })

    const update = {
      code: String(body.code || '').trim().toUpperCase(),
      name,
      type: String(body.type || 'OTHER').trim().toUpperCase(),
      default_vat_rate: Number(body.default_vat_rate ?? 27) || 27,
      default_net: body.default_net != null ? Number(body.default_net) : null,
      default_gross: body.default_gross != null ? Number(body.default_gross) : null,
      price_mode: body.price_mode || 'manual_only',
      is_active: body.is_active !== false,
      allow_manual_edit: body.allow_manual_edit !== false,
      allow_delete_from_order: body.allow_delete_from_order !== false,
      sort_order: Number(body.sort_order ?? 100) || 100,
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('fee_definitions')
      .update(update)
      .eq('id', id)
      .select('id, code, name, type, default_vat_rate, default_net, default_gross, price_mode, is_active, is_system, allow_manual_edit, allow_delete_from_order, sort_order, created_at, updated_at')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ fee: data })
  } catch (e) {
    console.error('PUT /api/fees/[id]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase
      .from('fee_definitions')
      .update({ deleted_at: new Date().toISOString(), is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE /api/fees/[id]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

