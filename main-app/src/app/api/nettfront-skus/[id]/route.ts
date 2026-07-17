import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

import { supabaseServer } from '@/lib/supabase-server'
import { isValidHexColor } from '@/lib/nettfront-sku-constants'

const ALLOWED_FRONT_TYPES = new Set(['inomat', 'festett', 'folias', 'alu', 'akril'])
const ALLOWED_FINISHES = new Set(['matt', 'hg'])

async function requireAuth() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {}
      }
    }
  )
  const {
    data: { user },
    error
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

function normalizePayload(body: Record<string, unknown>) {
  const front_type = String(body.front_type || '').trim()
  const sku_code = String(body.sku_code || '').trim()
  const display_name = String(body.display_name || '').trim()
  const finishRaw = body.finish === '' || body.finish == null ? null : String(body.finish).trim()
  const swatch_hex =
    body.swatch_hex === '' || body.swatch_hex == null
      ? null
      : String(body.swatch_hex).trim()
  const cost_net_per_sqm = Number(body.cost_net_per_sqm)
  const sell_net_per_sqm = Number(body.sell_net_per_sqm)
  const is_active = body.is_active !== false
  const sort_order = Number(body.sort_order) || 0

  const errors: string[] = []
  if (!ALLOWED_FRONT_TYPES.has(front_type)) errors.push('Érvénytelen front típus')
  if (!sku_code) errors.push('SKU kód kötelező')
  if (!display_name) errors.push('Megjelenő név kötelező')
  if (finishRaw && !ALLOWED_FINISHES.has(finishRaw)) errors.push('Érvénytelen finish')
  if (!isValidHexColor(swatch_hex)) errors.push('Swatch hex formátum: #RRGGBB')
  if (!Number.isFinite(cost_net_per_sqm) || cost_net_per_sqm < 0) {
    errors.push('Bekerülés ár érvénytelen')
  }
  if (!Number.isFinite(sell_net_per_sqm) || sell_net_per_sqm < 0) {
    errors.push('Eladási ár érvénytelen')
  }

  return {
    errors,
    data: {
      front_type,
      sku_code,
      display_name,
      finish: finishRaw,
      swatch_hex,
      cost_net_per_sqm,
      sell_net_per_sqm,
      is_active,
      sort_order,
      updated_at: new Date().toISOString()
    }
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { data, error } = await supabaseServer
      .from('nettfront_skus')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[nettfront-skus GET id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { errors, data } = normalizePayload(body)
    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
    }

    const { data: updated, error } = await supabaseServer
      .from('nettfront_skus')
      .update(data)
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .single()

    if (error) {
      console.error('[nettfront-skus PUT]', error)
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Ez a front típus + SKU kód már létezik' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: 'Mentés sikertelen' }, { status: 500 })
    }

    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[nettfront-skus PUT]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Soft deactivate (is_active) — prefer DELETE for soft-delete */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const is_active = body.is_active === true

    const { data: updated, error } = await supabaseServer
      .from('nettfront_skus')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .single()

    if (error || !updated) {
      console.error('[nettfront-skus PATCH]', error)
      return NextResponse.json({ error: 'Frissítés sikertelen' }, { status: 500 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[nettfront-skus PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Soft delete — sets deleted_at */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const now = new Date().toISOString()

    const { data: updated, error } = await supabaseServer
      .from('nettfront_skus')
      .update({
        deleted_at: now,
        is_active: false,
        updated_at: now
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .single()

    if (error || !updated) {
      console.error('[nettfront-skus DELETE]', error)
      return NextResponse.json({ error: 'Törlés sikertelen' }, { status: 500 })
    }

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error('[nettfront-skus DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
