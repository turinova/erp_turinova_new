import { NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/orders/buffer/count
 * Returns total count of pending buffer orders (for nav badge).
 */
export async function GET() {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { count, error } = await supabase
      .from('order_buffer')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')

    if (error) {
      console.error('[BUFFER COUNT]', error)
      return NextResponse.json({ error: 'Failed to get count', details: error.message }, { status: 500 })
    }

    return NextResponse.json({ count: count ?? 0 })
  } catch (e) {
    console.error('[BUFFER COUNT]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
