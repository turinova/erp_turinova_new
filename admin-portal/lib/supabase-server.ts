import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Admin portal Supabase credentials (Admin Database)
// Accept both NEXT_PUBLIC_SUPABASE_ANON_KEY and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Create a standard server client (for authenticated API routes)
export const createClient = async () => {
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `cookies().set()` method can only be called from a Server Component
          // or Server Action. Let's ignore this error on the client.
        }
      },
    },
  })
}

// Create an admin client with service role (for tenants CRUD)
export const createAdminClient = () => {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase credentials for admin client')
  }
  
  return createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Get all tenants with subscription and credit usage stats
 */
export async function getAllTenants() {
  const supabase = createAdminClient()

  // Get all tenants
  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Admin] Error fetching tenants:', error)
    throw error
  }

  if (!tenants || tenants.length === 0) {
    return []
  }

  // Get all subscriptions for these tenants in one query
  const tenantIds = tenants.map(t => t.id)
  const { data: allSubscriptions, error: subscriptionsError } = await supabase
    .from('tenant_subscriptions')
    .select(`
      id,
      tenant_id,
      status,
      plan_id,
      bonus_credits,
      purchased_credits,
      subscription_plans (
        id,
        name,
        slug,
        ai_credits_per_month
      )
    `)
    .in('tenant_id', tenantIds)

  if (subscriptionsError) {
    console.error('[Admin] Error fetching subscriptions:', subscriptionsError)
  }

  // Create a map of tenant_id -> subscription for quick lookup
  const subscriptionMap = new Map()
  if (allSubscriptions) {
    allSubscriptions.forEach(sub => {
      subscriptionMap.set(sub.tenant_id, sub)
    })
  }

  // Fetch credit usage and combine with subscription data for each tenant
  const tenantsWithStats = await Promise.all(
    tenants.map(async (tenant) => {
      // Get current month credit usage
      const { data: creditUsage } = await supabase
        .rpc('get_tenant_credit_usage_current_month', { tenant_uuid: tenant.id })
        .single()

      // Get subscription from map
      const subscription = subscriptionMap.get(tenant.id) || null
      
      // Handle plan data
      let plan = null
      if (subscription) {
        if (Array.isArray(subscription.subscription_plans)) {
          plan = subscription.subscription_plans[0] || null
        } else {
          plan = subscription.subscription_plans || null
        }
      }

      // Calculate effective credit limit (plan + bonus + purchased)
      const planLimit = plan?.ai_credits_per_month || 0
      const bonusCredits = subscription?.bonus_credits || 0
      const purchasedCredits = subscription?.purchased_credits || 0
      const effectiveLimit = planLimit + bonusCredits + purchasedCredits

      return {
        ...tenant,
        subscription_status: subscription?.status || tenant.subscription_status || 'trial',
        subscription_plan_id: subscription?.plan_id || null,
        subscription_plan: plan ? {
          id: plan.id,
          name: plan.name,
          slug: plan.slug,
          ai_credits_per_month: plan.ai_credits_per_month
        } : null,
        credit_usage: creditUsage?.total_credits_used || 0,
        credit_limit: effectiveLimit > 0 ? effectiveLimit : null
      }
    })
  )

  return tenantsWithStats
}

/**
 * Get tenant by ID
 */
export async function getTenantById(id: string) {
  const supabase = createAdminClient()

  // First, get the tenant
  const { data: tenantData, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (tenantError) {
    console.error('[Admin] Error fetching tenant:', tenantError)
    return null
  }

  // Query subscription separately to avoid join issues
  const { data: subscriptionData, error: subscriptionError } = await supabase
    .from('tenant_subscriptions')
    .select(`
      id,
      status,
      plan_id,
      bonus_credits,
      purchased_credits,
      last_usage_reset_at,
      current_period_start,
      current_period_end,
      trial_end,
      canceled_at,
      subscription_plans (
        id,
        name,
        slug,
        ai_credits_per_month
      )
    `)
    .eq('tenant_id', id)
    .maybeSingle()

  if (subscriptionError) {
    console.error('[Admin] Error fetching subscription:', subscriptionError)
  }

  // Get credit usage
  const { data: creditUsage } = await supabase
    .rpc('get_tenant_credit_usage_current_month', { tenant_uuid: id })
    .single()

  // Handle subscription and plan data
  const subscription = subscriptionData || null
  let plan = null
  
  if (subscription) {
    // subscription_plans is returned as a single object (not array) when using foreign key relationship
    if (Array.isArray(subscription.subscription_plans)) {
      plan = subscription.subscription_plans[0] || null
    } else {
      plan = subscription.subscription_plans || null
    }
  }

  // Extract plan_id from subscription
  const planId = subscription?.plan_id || null

  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('[getTenantById] Debug:', {
      tenantId: id,
      hasSubscription: !!subscription,
      subscriptionData: subscription ? {
        id: subscription.id,
        plan_id: subscription.plan_id,
        status: subscription.status
      } : null,
      planId: planId,
      hasPlan: !!plan,
      planData: plan ? {
        id: plan.id,
        name: plan.name,
        ai_credits_per_month: plan.ai_credits_per_month
      } : null,
      rawSubscriptionData: subscriptionData
    })
  }

  // Calculate effective credit limit (plan + bonus + purchased)
  const planLimit = plan?.ai_credits_per_month || 0
  const bonusCredits = subscription?.bonus_credits || 0
  const purchasedCredits = subscription?.purchased_credits || 0
  const effectiveLimit = planLimit + bonusCredits + purchasedCredits

  return {
    ...tenantData,
    subscription_status: subscription?.status || tenantData.subscription_status || 'trial',
    subscription_plan_id: planId,
    subscription_plan: plan ? {
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      ai_credits_per_month: plan.ai_credits_per_month
    } : null,
    bonus_credits: bonusCredits,
    purchased_credits: purchasedCredits,
    last_usage_reset_at: subscription?.last_usage_reset_at || null,
    credit_usage: creditUsage?.total_credits_used || 0,
    credit_limit: effectiveLimit > 0 ? effectiveLimit : null
  }
}

/**
 * Create new tenant
 */
export async function createTenant(tenantData: any) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('tenants')
    .insert({
      name: tenantData.name,
      slug: tenantData.slug,
      supabase_project_id: tenantData.supabase_project_id || '',
      supabase_url: tenantData.supabase_url,
      supabase_anon_key: tenantData.supabase_anon_key,
      supabase_service_role_key: tenantData.supabase_service_role_key || '',
      is_active: tenantData.is_active !== undefined ? tenantData.is_active : true,
      subscription_status: tenantData.subscription_status || 'trial',
      trial_ends_at: tenantData.trial_ends_at || null
    })
    .select()
    .single()

  if (error) {
    console.error('[Admin] Error creating tenant:', error)
    throw error
  }

  // If plan_id is provided, create subscription
  if (tenantData.plan_id) {
    await supabase
      .from('tenant_subscriptions')
      .insert({
        tenant_id: data.id,
        plan_id: tenantData.plan_id,
        status: tenantData.subscription_status || 'active'
      })
  }

  return data
}

/**
 * Update tenant
 */
export async function updateTenant(id: string, tenantData: any) {
  const supabase = createAdminClient()

  const updateData: any = {
    updated_at: new Date().toISOString()
  }

  if (tenantData.name !== undefined) updateData.name = tenantData.name
  if (tenantData.slug !== undefined) updateData.slug = tenantData.slug
  if (tenantData.supabase_project_id !== undefined) updateData.supabase_project_id = tenantData.supabase_project_id
  if (tenantData.supabase_url !== undefined) updateData.supabase_url = tenantData.supabase_url
  if (tenantData.supabase_anon_key !== undefined) updateData.supabase_anon_key = tenantData.supabase_anon_key
  if (tenantData.supabase_service_role_key !== undefined) updateData.supabase_service_role_key = tenantData.supabase_service_role_key
  if (tenantData.is_active !== undefined) updateData.is_active = tenantData.is_active
  if (tenantData.subscription_status !== undefined) updateData.subscription_status = tenantData.subscription_status
  if (tenantData.trial_ends_at !== undefined) updateData.trial_ends_at = tenantData.trial_ends_at

  const { data, error } = await supabase
    .from('tenants')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[Admin] Error updating tenant:', error)
    throw error
  }

  // Update subscription if plan_id is provided
  if (tenantData.plan_id !== undefined) {
    // Check if subscription exists
    const { data: existingSubscription } = await supabase
      .from('tenant_subscriptions')
      .select('id')
      .eq('tenant_id', id)
      .maybeSingle()

    if (existingSubscription) {
      // Update existing subscription
      await supabase
        .from('tenant_subscriptions')
        .update({
          plan_id: tenantData.plan_id,
          status: tenantData.subscription_status || 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSubscription.id)
    } else if (tenantData.plan_id) {
      // Create new subscription
      await supabase
        .from('tenant_subscriptions')
        .insert({
          tenant_id: id,
          plan_id: tenantData.plan_id,
          status: tenantData.subscription_status || 'active'
        })
    }
  }

  return data
}

/**
 * Soft delete tenant (set deleted_at)
 */
export async function deleteTenant(id: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('tenants')
    .update({ 
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString() 
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[Admin] Error deleting tenant:', error)
    throw error
  }

  return data
}

/**
 * Test Supabase connection
 */
export async function testSupabaseConnection(url: string, anonKey: string) {
  try {
    const testClient = createSupabaseClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Try to fetch from a common table (this will fail gracefully if credentials are wrong)
    const { error } = await testClient.from('users').select('id').limit(1)

    if (error && error.message.includes('JWT')) {
      return { success: false, error: 'Invalid Supabase credentials' }
    }

    return { success: true, error: null }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Get dashboard statistics for tenants
 */
export async function getDashboardStats() {
  const supabase = createAdminClient()

  // Total tenants
  const { count: totalTenants } = await supabase
    .from('tenants')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)

  // Active tenants
  const { count: activeTenants } = await supabase
    .from('tenants')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .is('deleted_at', null)

  // Total subscriptions
  const { count: totalSubscriptions } = await supabase
    .from('tenant_subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  // Active subscriptions
  const { count: activeSubscriptions } = await supabase
    .from('tenant_subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  // Total Turitoken used this month (aggregate from all tenants)
  const { data: allTenants } = await supabase
    .from('tenants')
    .select('id')
    .is('deleted_at', null)

  let totalTuritokenUsed = 0
  if (allTenants && allTenants.length > 0) {
    const creditUsagePromises = allTenants.map(tenant =>
      supabase
        .rpc('get_tenant_credit_usage_current_month', { tenant_uuid: tenant.id })
        .single()
    )
    
    const creditUsageResults = await Promise.allSettled(creditUsagePromises)
    totalTuritokenUsed = creditUsageResults.reduce((sum, result) => {
      if (result.status === 'fulfilled' && result.value.data) {
        return sum + (result.value.data.total_credits_used || 0)
      }
      return sum
    }, 0)
  }

  return {
    totalTenants: totalTenants || 0,
    activeTenants: activeTenants || 0,
    totalSubscriptions: totalSubscriptions || 0,
    activeSubscriptions: activeSubscriptions || 0,
    totalTuritokenUsed: totalTuritokenUsed
  }
}

/**
 * Get all subscription plans
 */
export async function getAllSubscriptionPlans(includeInactive = false) {
  const supabase = createAdminClient()

  let query = supabase
    .from('subscription_plans')
    .select('*')
    .order('display_order', { ascending: true })

  if (!includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data: plans, error } = await query

  if (error) {
    console.error('[Admin] Error fetching subscription plans:', error)
    return []
  }

  if (!plans || plans.length === 0) {
    return []
  }

  // Get all subscriptions to count tenants per plan
  const planIds = plans.map(p => p.id)
  const { data: allSubscriptions } = await supabase
    .from('tenant_subscriptions')
    .select('plan_id, tenant_id')
    .in('plan_id', planIds)

  // Create a map of plan_id -> unique tenant count
  const tenantCountMap = new Map<string, Set<string>>()
  if (allSubscriptions) {
    allSubscriptions.forEach(sub => {
      if (!tenantCountMap.has(sub.plan_id)) {
        tenantCountMap.set(sub.plan_id, new Set())
      }
      tenantCountMap.get(sub.plan_id)!.add(sub.tenant_id)
    })
  }

  // Add tenant count to each plan
  const plansWithStats = plans.map(plan => ({
    ...plan,
    tenant_count: tenantCountMap.get(plan.id)?.size || 0
  }))

  return plansWithStats
}

/**
 * Get subscription plan by ID
 */
export async function getSubscriptionPlanById(id: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[Admin] Error fetching subscription plan:', error)
    return null
  }

  if (!data) return null

  // Get tenant count for this plan
  const { data: subscriptions } = await supabase
    .from('tenant_subscriptions')
    .select('tenant_id')
    .eq('plan_id', id)

  const uniqueTenants = new Set(subscriptions?.map(s => s.tenant_id) || [])

  return {
    ...data,
    tenant_count: uniqueTenants.size
  }
}

/**
 * Create new subscription plan
 */
export async function createSubscriptionPlan(planData: any) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('subscription_plans')
    .insert({
      name: planData.name,
      slug: planData.slug,
      price_monthly: planData.price_monthly || null,
      price_yearly: planData.price_yearly || null,
      features: planData.features || {},
      ai_credits_per_month: planData.ai_credits_per_month || null,
      is_active: planData.is_active !== undefined ? planData.is_active : true,
      display_order: planData.display_order || 0,
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) {
    console.error('[Admin] Error creating subscription plan:', error)
    throw error
  }

  return data
}

/**
 * Update subscription plan
 */
export async function updateSubscriptionPlan(id: string, planData: any) {
  const supabase = createAdminClient()

  const updateData: any = {
    updated_at: new Date().toISOString()
  }

  if (planData.name !== undefined) updateData.name = planData.name
  if (planData.slug !== undefined) updateData.slug = planData.slug
  if (planData.price_monthly !== undefined) updateData.price_monthly = planData.price_monthly
  if (planData.price_yearly !== undefined) updateData.price_yearly = planData.price_yearly
  if (planData.features !== undefined) updateData.features = planData.features
  if (planData.ai_credits_per_month !== undefined) updateData.ai_credits_per_month = planData.ai_credits_per_month
  if (planData.is_active !== undefined) updateData.is_active = planData.is_active
  if (planData.display_order !== undefined) updateData.display_order = planData.display_order

  const { data, error } = await supabase
    .from('subscription_plans')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[Admin] Error updating subscription plan:', error)
    throw error
  }

  return data
}

/**
 * Delete subscription plan (soft delete by setting is_active = false)
 */
export async function deleteSubscriptionPlan(id: string) {
  const supabase = createAdminClient()

  // Check if any tenants are using this plan
  const { data: subscriptions, error: checkError } = await supabase
    .from('tenant_subscriptions')
    .select('id')
    .eq('plan_id', id)
    .limit(1)

  if (checkError) {
    console.error('[Admin] Error checking plan usage:', checkError)
    throw checkError
  }

  if (subscriptions && subscriptions.length > 0) {
    // Don't delete, just deactivate
    const { data, error } = await supabase
      .from('subscription_plans')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[Admin] Error deactivating subscription plan:', error)
      throw error
    }

    return { ...data, deactivated: true }
  } else {
    // No tenants using it, can hard delete
    const { error } = await supabase
      .from('subscription_plans')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[Admin] Error deleting subscription plan:', error)
      throw error
    }

    return { deleted: true }
  }
}

// Export aliases for backwards compatibility (will be removed later)
export { getAllTenants as getAllCompanies }
export { getTenantById as getCompanyById }
export { createTenant as createCompany }
export { updateTenant as updateCompany }
export { deleteTenant as deleteCompany }
export { getDashboardStats as getCompanyStats }
