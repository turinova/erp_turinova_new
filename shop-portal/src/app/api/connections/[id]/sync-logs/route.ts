import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: connectionId } = await params
    const supabase = await getTenantSupabase()

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Fetch sync audit logs for this connection
    const { data: logs, error } = await supabase
      .from('sync_audit_logs')
      .select('*')
      .eq('connection_id', connectionId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching sync logs:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Get total count
    const { count, error: countError } = await supabase
      .from('sync_audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('connection_id', connectionId)

    if (countError) {
      console.error('Error counting sync logs:', countError)
    }

    return NextResponse.json({
      success: true,
      logs: logs || [],
      total: count || 0
    })
  } catch (error) {
    console.error('Error in sync logs API:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
