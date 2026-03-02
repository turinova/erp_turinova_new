import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromSession, getAdminSupabase, getTenantSupabase } from '@/lib/tenant-supabase'

export async function GET(request: NextRequest) {
  try {
    // Get tenant context from session
    let tenant = await getTenantFromSession()
    
    // If tenant not found from cookie, try fallback: get user email and lookup tenant
    if (!tenant) {
      console.log('[SUBSCRIPTION API] Tenant context not in cookie, trying fallback...')
      
      // Try to get user email from any available source
      // First, try to get from default Supabase (for first tenant)
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const { createServerClient } = await import('@supabase/ssr')
      const defaultSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const defaultSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
      
      let userEmail: string | null = null
      
      // Try default Supabase first
      if (defaultSupabaseUrl && defaultSupabaseAnonKey) {
        try {
          const defaultSupabase = createServerClient(
            defaultSupabaseUrl,
            defaultSupabaseAnonKey,
            {
              cookies: {
                get(name: string) {
                  return cookieStore.get(name)?.value
                },
                set() {},
                remove() {},
              },
            }
          )
          
          const { data: { user }, error: userError } = await defaultSupabase.auth.getUser()
          if (!userError && user && user.email) {
            userEmail = user.email
            console.log('[SUBSCRIPTION API] Got user email from default Supabase:', userEmail)
          }
        } catch (error) {
          console.warn('[SUBSCRIPTION API] Could not get user from default Supabase:', error)
        }
      }
      
      // If we have user email, lookup tenant
      if (userEmail) {
        try {
          const adminSupabase = await getAdminSupabase()
          const { data: tenantData, error: tenantError } = await adminSupabase
            .rpc('get_tenant_by_user_email', { user_email_param: userEmail })

          if (!tenantError && tenantData && tenantData.length > 0) {
            const tenantInfo = tenantData[0]
            console.log('[SUBSCRIPTION API] Found tenant via email lookup:', tenantInfo.tenant_name)
            tenant = {
              id: tenantInfo.tenant_id,
              name: tenantInfo.tenant_name,
              slug: tenantInfo.tenant_slug,
              supabase_url: tenantInfo.supabase_url,
              supabase_anon_key: tenantInfo.supabase_anon_key,
              user_id_in_tenant_db: tenantInfo.user_id_in_tenant_db,
              user_role: tenantInfo.user_role
            }
          } else {
            console.warn('[SUBSCRIPTION API] No tenant found for email:', userEmail, tenantError)
          }
        } catch (error) {
          console.error('[SUBSCRIPTION API] Error looking up tenant:', error)
        }
      } else {
        console.warn('[SUBSCRIPTION API] Could not get user email for tenant lookup')
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
    // Include both 'active' and 'trial' statuses
    const { data: subscriptionOnly, error: subOnlyError } = await adminSupabase
      .from('tenant_subscriptions')
      .select('*')
      .eq('tenant_id', tenant.id)
      .in('status', ['active', 'trial'])
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
    // Include both 'active' and 'trial' statuses
    const { data: subscriptionData, error: subError } = await adminSupabase
      .from('tenant_subscriptions')
      .select(`
        *,
        subscription_plans (*)
      `)
      .eq('tenant_id', tenant.id)
      .in('status', ['active', 'trial'])
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
      console.log('[SUBSCRIPTION API] No active subscription data found for tenant:', tenant.id, tenant.slug)
      
      // Try to find any subscription (not just active) for debugging
      const { data: anySubscription, error: anySubError } = await adminSupabase
        .from('tenant_subscriptions')
        .select('*')
        .eq('tenant_id', tenant.id)
        .maybeSingle()
      
      console.log('[SUBSCRIPTION API] Any subscription (any status) found:', {
        hasData: !!anySubscription,
        hasError: !!anySubError,
        error: anySubError,
        subscription: anySubscription ? {
          id: anySubscription.id,
          plan_id: anySubscription.plan_id,
          status: anySubscription.status,
          created_at: anySubscription.created_at
        } : null
      })
      
      // Also check if tenant exists in tenants table and has a plan_id
      // This is a fallback - if subscription record doesn't exist but tenant has plan_id,
      // we should create the subscription or return the plan info
      const { data: tenantCheck, error: tenantCheckError } = await adminSupabase
        .from('tenants')
        .select('id, name, slug, subscription_plan_id')
        .eq('id', tenant.id)
        .single()
      
      console.log('[SUBSCRIPTION API] Tenant check:', {
        hasData: !!tenantCheck,
        hasError: !!tenantCheckError,
        error: tenantCheckError,
        tenant: tenantCheck ? {
          id: tenantCheck.id,
          name: tenantCheck.name,
          slug: tenantCheck.slug,
          subscription_plan_id: tenantCheck.subscription_plan_id
        } : null
      })
      
      // If tenant has a plan_id but no subscription record, try to get the plan and return it
      // This handles cases where subscription wasn't created properly
      if (tenantCheck && tenantCheck.subscription_plan_id) {
        console.log('[SUBSCRIPTION API] Tenant has plan_id but no subscription record, fetching plan directly:', tenantCheck.subscription_plan_id)
        
        const { data: planData, error: planError } = await adminSupabase
          .from('subscription_plans')
          .select('*')
          .eq('id', tenantCheck.subscription_plan_id)
          .single()
        
        if (!planError && planData) {
          console.log('[SUBSCRIPTION API] Found plan for tenant, returning subscription with plan')
          
          // Return subscription object with plan (even though subscription record doesn't exist)
          // This allows the UI to work while we fix the missing subscription record
          const subscription: any = {
            id: null, // No subscription record ID
            plan_id: planData.id,
            status: 'active', // Assume active if plan is assigned
            current_period_end: null,
            plan: {
              id: planData.id,
              name: planData.name,
              slug: planData.slug,
              price_monthly: planData.price_monthly,
              price_yearly: planData.price_yearly,
              features: planData.features,
              ai_credits_per_month: planData.ai_credits_per_month
            }
          }
          
          return NextResponse.json({
            success: true,
            subscription,
            warning: 'Subscription record missing, using plan from tenant table'
          })
        }
      }
      
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
