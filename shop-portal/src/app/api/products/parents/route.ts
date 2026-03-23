import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = (searchParams.get('q') || '').trim()
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)

    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: relations, error: relErr } = await supabase
      .from('shoprenter_products')
      .select('parent_product_id')
      .is('deleted_at', null)
      .not('parent_product_id', 'is', null)

    if (relErr) {
      return NextResponse.json({ error: relErr.message }, { status: 500 })
    }

    const parentIds = [...new Set((relations || []).map((r: any) => r.parent_product_id).filter(Boolean))]
    if (parentIds.length === 0) {
      return NextResponse.json({ parents: [] })
    }

    let parentsQuery = supabase
      .from('shoprenter_products')
      .select('id, sku, name')
      .is('deleted_at', null)
      .in('id', parentIds)
      .order('sku', { ascending: true })
      .limit(limit)

    if (query.length >= 2) {
      const q = query.replace(/'/g, "''")
      parentsQuery = parentsQuery.or(`sku.ilike.%${q}%,name.ilike.%${q}%`)
    }

    const { data: parents, error: pErr } = await parentsQuery
    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 })
    }

    return NextResponse.json({ parents: parents || [] })
  } catch (error) {
    console.error('Error in parent products API:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
