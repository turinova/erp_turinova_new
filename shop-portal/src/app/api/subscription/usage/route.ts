import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromSession, getAdminSupabase, getTenantSupabase } from '@/lib/tenant-supabase'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    // Get tenant context from session
    let tenant = await getTenantFromSession()
    
    // If tenant not found from cookie, try to get user from tenant DB and lookup
    if (!tenant) {
      // Try to get user from tenant database session
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
          // Lookup tenant for this user in Admin DB
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
      console.error('No tenant context found. User might not be mapped to a tenant.')
      return NextResponse.json({ error: 'Unauthorized - No tenant context' }, { status: 401 })
    }

    // Get current month credit usage from Admin DB (tenant-level aggregation)
    const adminSupabase = await getAdminSupabase()
    
    let totalCreditsUsed = 0
    let totalTokens = 0
    let totalCost = 0
    let usageCount = 0

    // Use RPC function to get tenant-level usage
    const { data: tenantUsageData, error: tenantUsageError } = await adminSupabase
      .rpc('get_tenant_credit_usage_current_month', { tenant_uuid: tenant.id })

    if (tenantUsageError) {
      console.error('[USAGE API] Error fetching tenant usage via RPC:', tenantUsageError)
      // Fallback to direct query
      const now = new Date()
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString()

      const { data: creditUsageData, error: creditUsageError } = await adminSupabase
        .from('tenant_credit_usage_logs')
        .select('credits_used, tokens_used, cost_estimate')
        .eq('tenant_id', tenant.id)
        .gte('created_at', firstDayOfMonth)
        .lte('created_at', lastDayOfMonth)

      if (creditUsageError) {
        console.error('[USAGE API] Error fetching usage (fallback):', creditUsageError)
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch usage'
        }, { status: 500 })
      }

      // Calculate totals from fallback query
      totalTokens = creditUsageData?.reduce((sum, log) => sum + (log.tokens_used || 0), 0) || 0
      totalCost = creditUsageData?.reduce((sum, log) => sum + (parseFloat(log.cost_estimate?.toString() || '0') || 0), 0) || 0
      usageCount = creditUsageData?.length || 0
      totalCreditsUsed = creditUsageData?.reduce((sum, log) => sum + (log.credits_used || 0), 0) || 0
    } else {
      // Use RPC function results (tenant-level aggregation)
      const usage = tenantUsageData?.[0]
      totalCreditsUsed = usage?.total_credits_used || 0
      totalTokens = usage?.total_tokens_used || 0
      totalCost = parseFloat(usage?.total_cost?.toString() || '0') || 0
      usageCount = parseInt(usage?.usage_count?.toString() || '0') || 0
    }

    // Get tenant subscription from Admin DB to determine limit
    // Reuse adminSupabase from above (line 62)
    const { data: subscriptionData } = await adminSupabase
      .from('tenant_subscriptions')
      .select(`
        *,
        subscription_plans (*)
      `)
      .eq('tenant_id', tenant.id)
      .eq('status', 'active')
      .maybeSingle()

    let monthlyLimit: number | null = null
    let creditLimit: number | null = null
    let fullPlanData: any = null
    
    if (subscriptionData && subscriptionData.subscription_plans) {
      const plan = subscriptionData.subscription_plans as any
      const features = plan.features || {}
      monthlyLimit = features?.ai_monthly_limit || null
      
      // Calculate effective credit limit (plan + bonus + purchased)
      const planLimit = plan.ai_credits_per_month || 0
      const bonusCredits = subscriptionData.bonus_credits || 0
      const purchasedCredits = subscriptionData.purchased_credits || 0
      
      // If plan limit is null/Infinity, effective limit is also unlimited
      if (plan.ai_credits_per_month === null || plan.ai_credits_per_month === Infinity) {
        creditLimit = null
      } else {
        creditLimit = planLimit + bonusCredits + purchasedCredits
      }
      
      fullPlanData = plan
    }

    const remaining = monthlyLimit !== null ? Math.max(0, monthlyLimit - totalTokens) : null
    const percentageUsed = monthlyLimit !== null && monthlyLimit > 0 
      ? Math.min(100, (totalTokens / monthlyLimit) * 100) 
      : 0

    const creditRemaining = creditLimit !== null && creditLimit !== Infinity
      ? Math.max(0, creditLimit - totalCreditsUsed)
      : null
    const creditPercentage = creditLimit !== null && creditLimit !== Infinity && creditLimit > 0
      ? Math.min(100, (totalCreditsUsed / creditLimit) * 100)
      : 0

    return NextResponse.json({
      success: true,
      usage: {
        current_month: totalTokens,
        monthly_limit: monthlyLimit,
        remaining,
        percentage_used: percentageUsed,
        total_cost: totalCost,
        usage_count: usageCount
      },
      creditUsage: {
        total_credits_used: totalCreditsUsed,
        credit_limit: creditLimit,
        credit_remaining: creditRemaining,
        credit_percentage: creditPercentage
      },
      subscription: subscriptionData ? {
        ...subscriptionData,
        plan: fullPlanData
      } : null
    })
  } catch (error) {
    console.error('Error in GET /api/subscription/usage:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch usage'
    }, { status: 500 })
  }
}
