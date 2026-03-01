/**
 * Credit Checker for AI Features
 * Checks if tenant has enough credits before allowing AI operations
 * Credits are shared at tenant level, not per-user
 */

import { getTenantFromSession, getAdminSupabase } from './tenant-supabase'
import { calculateCreditsForAI, AIFeatureType } from './credit-calculator'

export interface CreditCheckResult {
  hasEnough: boolean
  available: number
  used: number
  limit: number
  required: number
}

/**
 * Get tenant's subscription with plan details from Admin DB
 */
async function getTenantSubscription(tenantId: string) {
  try {
    const adminSupabase = await getAdminSupabase()
    
    const { data: subscriptionData, error } = await adminSupabase
      .from('tenant_subscriptions')
      .select(`
        *,
        subscription_plans (*)
      `)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .maybeSingle()

    if (error || !subscriptionData || !subscriptionData.subscription_plans) {
      return null
    }

    const plan = subscriptionData.subscription_plans as any
    return {
      ...subscriptionData,
      bonus_credits: subscriptionData.bonus_credits || 0,
      purchased_credits: subscriptionData.purchased_credits || 0,
      plan: {
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
        ai_credits_per_month: plan.ai_credits_per_month,
        features: plan.features || {}
      }
    }
  } catch (error) {
    console.error('[CREDIT CHECKER] Error fetching tenant subscription:', error)
    return null
  }
}

/**
 * Get current month credit usage for tenant (tenant-level aggregation)
 */
async function getCurrentMonthCreditUsage(tenantId: string): Promise<number> {
  try {
    const adminSupabase = await getAdminSupabase()
    
    const { data, error } = await adminSupabase
      .rpc('get_tenant_credit_usage_current_month', { tenant_uuid: tenantId })

    if (error || !data || data.length === 0) {
      return 0
    }

    return data[0].total_credits_used || 0
  } catch (error) {
    console.error('[CREDIT CHECKER] Error fetching credit usage:', error)
    return 0
  }
}

/**
 * Check if tenant has enough credits for an operation
 * Note: Credits are shared at tenant level, not per-user
 */
export async function checkAvailableCredits(
  userId: string, // Still needed for logging, but credits are tenant-level
  requiredCredits: number
): Promise<CreditCheckResult> {
  try {
    // Get tenant context
    const tenant = await getTenantFromSession()
    if (!tenant) {
      console.error('[CREDIT CHECKER] No tenant context found')
      // Fail open - allow operation if tenant context missing
      return {
        hasEnough: true,
        available: Infinity,
        used: 0,
        limit: Infinity,
        required: requiredCredits
      }
    }

    // Get tenant subscription from Admin DB
    const subscription = await getTenantSubscription(tenant.id)
    
    // Calculate effective credit limit (plan + bonus + purchased)
    const planLimit = subscription?.plan?.ai_credits_per_month || 0
    const bonusCredits = subscription?.bonus_credits || 0
    const purchasedCredits = subscription?.purchased_credits || 0
    const effectiveLimit = planLimit + bonusCredits + purchasedCredits
    
    // If plan limit is null (unlimited), allow operation
    if (subscription?.plan?.ai_credits_per_month === null || subscription?.plan?.ai_credits_per_month === Infinity) {
      return {
        hasEnough: true,
        available: Infinity,
        used: 0,
        limit: Infinity,
        required: requiredCredits
      }
    }
    
    // Get current month usage (tenant-level)
    const used = await getCurrentMonthCreditUsage(tenant.id)
    const available = Math.max(0, effectiveLimit - used)
    
    return {
      hasEnough: available >= requiredCredits,
      available,
      used,
      limit: effectiveLimit,
      required: requiredCredits
    }
  } catch (error) {
    console.error('[CREDIT CHECKER] Error checking credits:', error)
    // On error, allow operation (fail open)
    return {
      hasEnough: true,
      available: Infinity,
      used: 0,
      limit: Infinity,
      required: requiredCredits
    }
  }
}

/**
 * Check credits for an AI feature
 */
export async function checkCreditsForAIFeature(
  userId: string,
  featureType: AIFeatureType
): Promise<CreditCheckResult> {
  const requiredCredits = calculateCreditsForAI(featureType)
  return checkAvailableCredits(userId, requiredCredits)
}

/**
 * Get credit usage stats for display (tenant-level)
 */
export async function getCreditUsageStats(userId: string): Promise<{
  used: number
  limit: number
  available: number
  percentage: number
}> {
  try {
    const tenant = await getTenantFromSession()
    if (!tenant) {
      return {
        used: 0,
        limit: Infinity,
        available: Infinity,
        percentage: 0
      }
    }

    const subscription = await getTenantSubscription(tenant.id)
    
    // Calculate effective credit limit (plan + bonus + purchased)
    const planLimit = subscription?.plan?.ai_credits_per_month ?? null
    const bonusCredits = subscription?.bonus_credits || 0
    const purchasedCredits = subscription?.purchased_credits || 0
    
    if (planLimit === null || planLimit === Infinity) {
      return {
        used: 0,
        limit: Infinity,
        available: Infinity,
        percentage: 0
      }
    }
    
    const effectiveLimit = planLimit + bonusCredits + purchasedCredits
    const used = await getCurrentMonthCreditUsage(tenant.id)
    const available = Math.max(0, effectiveLimit - used)
    const percentage = effectiveLimit > 0 ? (used / effectiveLimit) * 100 : 0
    
    return {
      used,
      limit: effectiveLimit,
      available,
      percentage
    }
  } catch (error) {
    console.error('[CREDIT CHECKER] Error getting credit stats:', error)
    return {
      used: 0,
      limit: Infinity,
      available: Infinity,
      percentage: 0
    }
  }
}
