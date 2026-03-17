import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/pick-batches
 * List pick batches with optional status filter
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const offset = (page - 1) * limit

    let query = supabase
      .from('pick_batches')
      .select(`
        id,
        code,
        name,
        status,
        created_by,
        created_by_user:created_by(id, email, full_name),
        started_at,
        completed_at,
        created_at,
        updated_at
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      if (status === 'active') {
        query = query.in('status', ['draft', 'in_progress'])
      } else {
        query = query.eq('status', status)
      }
    }

    query = query.range(offset, offset + limit - 1)
    const { data: batches, error, count } = await query

    if (error) {
      console.error('Error fetching pick batches:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a begyűjtések lekérdezésekor' },
        { status: 500 }
      )
    }

    const batchesWithOrderCount = await Promise.all(
      (batches || []).map(async (b: any) => {
        const { count: orderCount } = await supabase
          .from('pick_batch_orders')
          .select('*', { count: 'exact', head: true })
          .eq('pick_batch_id', b.id)
        return { ...b, order_count: orderCount ?? 0 }
      })
    )

    return NextResponse.json({
      pick_batches: batchesWithOrderCount,
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit)
      }
    })
  } catch (err) {
    console.error('Error in pick-batches GET:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/pick-batches
 * Create a new pick batch (optional name)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const name = body?.name ?? null

    const { data: batch, error } = await supabase
      .from('pick_batches')
      .insert({
        name: name || null,
        status: 'draft',
        created_by: user.id
      })
      .select('id, code, name, status, created_at')
      .single()

    if (error) {
      console.error('Error creating pick batch:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a begyűjtés létrehozásakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ pick_batch: batch })
  } catch (err) {
    console.error('Error in pick-batches POST:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
