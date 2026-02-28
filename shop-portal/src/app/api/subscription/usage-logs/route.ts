import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * GET /api/subscription/usage-logs
 * Fetch credit usage logs for the current user
 * Query params: limit (default: 50), offset (default: 0), startDate, endDate, featureType
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const featureType = searchParams.get('featureType')

    // Build query
    let query = supabase
      .from('ai_usage_logs')
      .select(`
        id,
        feature_type,
        credits_used,
        credit_type,
        created_at,
        product_id,
        shoprenter_products (
          id,
          name,
          sku
        )
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }
    if (featureType) {
      query = query.eq('feature_type', featureType)
    }

    // Only get current month by default if no date filters
    if (!startDate && !endDate) {
      const now = new Date()
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
      query = query.gte('created_at', firstDayOfMonth).lte('created_at', lastDayOfMonth)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching usage logs:', error)
      return NextResponse.json({ 
        success: false,
        error: 'Failed to fetch usage logs' 
      }, { status: 500 })
    }

    // Transform data to include product name
    const logs = (data || []).map((log: any) => ({
      id: log.id,
      feature_type: log.feature_type,
      credits_used: log.credits_used,
      credit_type: log.credit_type,
      created_at: log.created_at,
      product_id: log.product_id,
      product_name: log.shoprenter_products?.name || null,
      product_sku: log.shoprenter_products?.sku || null
    }))

    return NextResponse.json({
      success: true,
      logs,
      total: count || 0,
      limit,
      offset
    })
  } catch (error) {
    console.error('Error in GET /api/subscription/usage-logs:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch usage logs'
    }, { status: 500 })
  }
}
