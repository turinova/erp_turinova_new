import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromSession, getAdminSupabase } from '@/lib/tenant-supabase'
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

    // Get subscription from Admin DB (tenant-based)
    const adminSupabase = await getAdminSupabase()

    console.log('[SUBSCRIPTION API] Looking up subscription for tenant:', tenant.id, tenant.slug)

    // First, try to get subscription without join to see if it exists
    const { data: subscriptionOnly, error: subOnlyError } = await adminSupabase
      .from('tenant_subscriptions')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('status', 'active')
      .maybeSingle()

    console.log('[SUBSCRIPTION API] Subscription only query:', {
      hasData: !!subscriptionOnly,
      hasError: !!subOnlyError,
      error: subOnlyError,
      subscriptionId: subscriptionOnly?.id,
      planId: subscriptionOnly?.plan_id,
      status: subscriptionOnly?.status
    })

    // Get tenant subscription with plan details
    const { data: subscriptionData, error: subError } = await adminSupabase
      .from('tenant_subscriptions')
      .select(`
        *,
        subscription_plans (*)
      `)
      .eq('tenant_id', tenant.id)
      .eq('status', 'active')
      .maybeSingle()

    console.log('[SUBSCRIPTION API] Query result with join:', {
      hasData: !!subscriptionData,
      hasError: !!subError,
      error: subError,
      subscriptionId: subscriptionData?.id,
      planId: subscriptionData?.plan_id,
      status: subscriptionData?.status,
      hasPlan: !!subscriptionData?.subscription_plans
    })

    if (subError) {
      console.error('[SUBSCRIPTION API] Error fetching tenant subscription:', subError)
      // Return null subscription if not found (tenant has no subscription)
      return NextResponse.json({
        success: true,
        subscription: null
      })
    }

    if (!subscriptionData) {
      console.log('[SUBSCRIPTION API] No subscription data found')
      // Try to find any subscription (not just active) for debugging
      const { data: anySubscription } = await adminSupabase
        .from('tenant_subscriptions')
        .select('*')
        .eq('tenant_id', tenant.id)
        .maybeSingle()
      console.log('[SUBSCRIPTION API] Any subscription found:', anySubscription)
      
      return NextResponse.json({
        success: true,
        subscription: null
      })
    }

    // If join didn't work, fetch plan separately
    let plan: any = null
    if (subscriptionData.subscription_plans) {
      plan = subscriptionData.subscription_plans
    } else if (subscriptionData.plan_id) {
      console.log('[SUBSCRIPTION API] Plan not in join, fetching separately for plan_id:', subscriptionData.plan_id)
      const { data: planData, error: planError } = await adminSupabase
        .from('subscription_plans')
        .select('*')
        .eq('id', subscriptionData.plan_id)
        .single()
      
      if (planError) {
        console.error('[SUBSCRIPTION API] Error fetching plan:', planError)
        return NextResponse.json({
          success: true,
          subscription: null
        })
      }
      plan = planData
    }

    if (!plan) {
      console.log('[SUBSCRIPTION API] No plan found for subscription')
      return NextResponse.json({
        success: true,
        subscription: null
      })
    }

    const subscription: any = {
      id: subscriptionData.id,
      plan_id: subscriptionData.plan_id,
      status: subscriptionData.status,
      current_period_end: subscriptionData.current_period_end,
      plan: {
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
        price_monthly: plan.price_monthly,
        price_yearly: plan.price_yearly,
        features: plan.features,
        ai_credits_per_month: plan.ai_credits_per_month // Include credit limit
      }
    }

    return NextResponse.json({
      success: true,
      subscription
    })
  } catch (error) {
    console.error('Error in GET /api/subscription/current:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch subscription'
    }, { status: 500 })
  }
}
