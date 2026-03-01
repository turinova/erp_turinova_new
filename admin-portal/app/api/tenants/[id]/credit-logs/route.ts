import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// GET /api/tenants/[id]/credit-logs - Get credit usage logs for a tenant
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createAdminClient()

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const featureType = searchParams.get('featureType')

    let query = supabase
      .from('tenant_credit_usage_logs')
      .select(`
        id,
        feature_type,
        credits_used,
        credit_type,
        created_at,
        user_email,
        product_context
      `, { count: 'exact' })
      .eq('tenant_id', id)
      .or('is_reset.is.null,is_reset.eq.false') // Exclude reset logs
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Default to current month if no dates specified
    if (!startDate || !endDate) {
      const now = new Date()
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString()

      query = query.gte('created_at', startDate || firstDayOfMonth)
      query = query.lte('created_at', endDate || lastDayOfMonth)
    } else {
      query = query.gte('created_at', startDate)
      query = query.lte('created_at', endDate)
    }

    if (featureType) {
      query = query.eq('feature_type', featureType)
    }

    const { data: logs, error, count } = await query

    if (error) {
      console.error('Error fetching credit logs:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const formattedLogs = logs?.map(log => ({
      id: log.id,
      feature_type: log.feature_type,
      credits_used: log.credits_used,
      credit_type: log.credit_type,
      created_at: log.created_at,
      user_email: log.user_email || null,
      product_context: log.product_context || null,
    })) || []

    return NextResponse.json({ success: true, logs: formattedLogs, total: count })

  } catch (error) {
    console.error('Error in GET /api/tenants/[id]/credit-logs:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch credit logs'
    }, { status: 500 })
  }
}
