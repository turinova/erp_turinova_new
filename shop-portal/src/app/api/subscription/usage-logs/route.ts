import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromSession, getAdminSupabase } from '@/lib/tenant-supabase'
import { cookies } from 'next/headers'

/**
 * GET /api/subscription/usage-logs
 * Fetch credit usage logs for the tenant (all users in tenant, since credits are shared)
 * Query params: limit (default: 20), offset (default: 0), startDate, endDate, featureType
 */
export async function GET(request: NextRequest) {
  try {
    // Get tenant context from session
    let tenant = await getTenantFromSession()
    
    // If tenant not found from cookie, try to get user from tenant DB and lookup
    if (!tenant) {
      const cookieStore = await cookies()
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
      
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && supabaseAnonKey) {
        const { createServerClient } = await import('@supabase/ssr')
        const tenantSupabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          supabaseAnonKey,
          {
            cookies: {
              getAll: () => cookieStore.getAll(),
              setAll: () => {}, // Read-only
            },
          }
        )

        const { data: { user }, error: userError } = await tenantSupabase.auth.getUser()
        
        if (!userError && user && user.email) {
          const adminSupabase = await getAdminSupabase()
          const { data: tenantData, error: tenantError } = await adminSupabase
            .rpc('get_tenant_by_user_email', { user_email_param: user.email })

          if (!tenantError && tenantData && tenantData.length > 0) {
            const tenantInfo = tenantData[0]
            tenant = {
              id: tenantInfo.tenant_id,
              name: tenantInfo.tenant_name,
              slug: tenantInfo.tenant_slug,
              supabase_url: tenantInfo.supabase_url,
              supabase_anon_key: tenantInfo.supabase_anon_key,
              user_id_in_tenant_db: tenantInfo.user_id_in_tenant_db,
              user_role: tenantInfo.user_role
            }
          }
        }
      }
    }
    
    if (!tenant) {
      return NextResponse.json({ error: 'Unauthorized - No tenant context' }, { status: 401 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const featureType = searchParams.get('featureType')

    // Get Admin Supabase client
    const adminSupabase = await getAdminSupabase()

    // Build query - get tenant-level logs (all users in tenant)
    // Exclude reset logs (is_reset = false or null)
    let query = adminSupabase
      .from('tenant_credit_usage_logs')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .or('is_reset.is.null,is_reset.eq.false') // Exclude reset logs
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
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString()
      query = query.gte('created_at', firstDayOfMonth).lte('created_at', lastDayOfMonth)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[USAGE LOGS API] Error fetching usage logs:', error)
      return NextResponse.json({ 
        success: false,
        error: 'Failed to fetch usage logs' 
      }, { status: 500 })
    }

    // Transform data - extract product context from JSON
    const logs = (data || []).map((log: any) => ({
      id: log.id,
      feature_type: log.feature_type,
      credits_used: log.credits_used,
      credit_type: log.credit_type,
      created_at: log.created_at,
      product_id: log.product_context?.product_id || null,
      product_name: log.product_context?.product_name || null,
      product_sku: log.product_context?.product_sku || null,
      user_id_in_tenant_db: log.user_id_in_tenant_db,
      user_email: log.user_email
    }))

    return NextResponse.json({
      success: true,
      logs,
      total: count || 0,
      limit,
      offset
    })
  } catch (error) {
    console.error('[USAGE LOGS API] Error in GET /api/subscription/usage-logs:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch usage logs'
    }, { status: 500 })
  }
}
