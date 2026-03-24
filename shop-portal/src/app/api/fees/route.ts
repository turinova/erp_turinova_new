import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const activeOnly = request.nextUrl.searchParams.get('active') === 'true'
    let q = supabase
      .from('fee_definitions')
      .select('id, code, name, type, default_vat_rate, default_net, default_gross, price_mode, is_active, is_system, allow_manual_edit, allow_delete_from_order, sort_order, created_at, updated_at')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    if (activeOnly) q = q.eq('is_active', true)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ fees: data || [] })
  } catch (e) {
    console.error('GET /api/fees', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const code = String(body.code || '').trim().toUpperCase()
    const name = String(body.name || '').trim()
    const type = String(body.type || 'OTHER').trim().toUpperCase()
    if (!code || !name) return NextResponse.json({ error: 'Kód és név kötelező' }, { status: 400 })

    const insert = {
      code,
      name,
      type,
      default_vat_rate: Number(body.default_vat_rate ?? 27) || 27,
      default_net: body.default_net != null ? Number(body.default_net) : null,
      default_gross: body.default_gross != null ? Number(body.default_gross) : null,
      price_mode: body.price_mode || 'manual_only',
      is_active: body.is_active !== false,
      is_system: body.is_system === true,
      allow_manual_edit: body.allow_manual_edit !== false,
      allow_delete_from_order: body.allow_delete_from_order !== false,
      sort_order: Number(body.sort_order ?? 100) || 100
    }

    const { data, error } = await supabase
      .from('fee_definitions')
      .insert(insert)
      .select('id, code, name, type, default_vat_rate, default_net, default_gross, price_mode, is_active, is_system, allow_manual_edit, allow_delete_from_order, sort_order, created_at, updated_at')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ fee: data }, { status: 201 })
  } catch (e) {
    console.error('POST /api/fees', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

