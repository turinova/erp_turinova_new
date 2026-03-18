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
    const search = searchParams.get('search')?.trim()
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const offset = (page - 1) * limit

    const selectColumns = `
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
    `

    let batches: any[] = []
    let count: number | null = 0

    if (search) {
      const byCode = await supabase
        .from('pick_batches')
        .select('id')
        .ilike('code', `%${search}%`)
      const idsByCode = (byCode.data || []).map((r: { id: string }) => r.id)

      const { data: usersMatch } = await supabase
        .from('users')
        .select('id')
        .or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
      const creatorIds = (usersMatch || []).map((u: { id: string }) => u.id)
      let idsByCreator: string[] = []
      if (creatorIds.length > 0) {
        const { data: batchesByCreator } = await supabase
          .from('pick_batches')
          .select('id')
          .in('created_by', creatorIds)
        idsByCreator = (batchesByCreator || []).map((r: { id: string }) => r.id)
      }

      const mergedIds = [...new Set([...idsByCode, ...idsByCreator])]
      if (mergedIds.length === 0) {
        return NextResponse.json({
          pick_batches: [],
          pagination: { page, limit, total: 0, totalPages: 0 }
        })
      }

      let listQuery = supabase
        .from('pick_batches')
        .select(selectColumns, { count: 'exact' })
        .in('id', mergedIds)
        .order('created_at', { ascending: false })
      if (status && status !== 'all') {
        if (status === 'active') {
          listQuery = listQuery.in('status', ['draft', 'in_progress'])
        } else {
          listQuery = listQuery.eq('status', status)
        }
      }
      const res = await listQuery.range(offset, offset + limit - 1)
      if (res.error) {
        console.error('Error fetching pick batches:', res.error)
        return NextResponse.json(
          { error: res.error.message || 'Hiba a begyűjtések lekérdezésekor' },
          { status: 500 }
        )
      }
      batches = res.data || []
      count = res.count
    } else {
      let query = supabase
        .from('pick_batches')
        .select(selectColumns, { count: 'exact' })
        .order('created_at', { ascending: false })
      if (status && status !== 'all') {
        if (status === 'active') {
          query = query.in('status', ['draft', 'in_progress'])
        } else {
          query = query.eq('status', status)
        }
      }
      const res = await query.range(offset, offset + limit - 1)
      if (res.error) {
        console.error('Error fetching pick batches:', res.error)
        return NextResponse.json(
          { error: res.error.message || 'Hiba a begyűjtések lekérdezésekor' },
          { status: 500 }
        )
      }
      batches = res.data || []
      count = res.count
    }

    const batchesWithCounts = await Promise.all(
      (batches || []).map(async (b: any) => {
        const { data: orderRows } = await supabase
          .from('pick_batch_orders')
          .select('order_id')
          .eq('pick_batch_id', b.id)
        const orderIds = (orderRows || []).map((r: { order_id: string }) => r.order_id)
        const orderCount = orderIds.length
        let itemCount = 0
        if (orderIds.length > 0) {
          const { count: itemCountRes } = await supabase
            .from('order_items')
            .select('*', { count: 'exact', head: true })
            .in('order_id', orderIds)
            .is('deleted_at', null)
          itemCount = itemCountRes ?? 0
        }
        return { ...b, order_count: orderCount, item_count: itemCount }
      })
    )

    return NextResponse.json({
      pick_batches: batchesWithCounts,
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
