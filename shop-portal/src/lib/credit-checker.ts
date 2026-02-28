/**
 * Credit Checker for AI Features
 * Checks if user has enough credits before allowing AI operations
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { calculateCreditsForAI, AIFeatureType } from './credit-calculator'

export interface CreditCheckResult {
  hasEnough: boolean
  available: number
  used: number
  limit: number
  required: number
}

/**
 * Get user's subscription with plan details
 */
async function getUserSubscription(userId: string) {
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

  // Get subscription with plan using RPC function
  const { data, error } = await supabase
    .rpc('get_user_subscription_with_plan', { user_uuid: userId })

  if (error || !data || data.length === 0) {
    return null
  }

  const subscription = data[0]
  
  // ALWAYS fetch plan details directly from subscription_plans table
  // This ensures we get the most up-to-date ai_credits_per_month value
  // (especially important after test-override)
  if (subscription.plan_id) {
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('ai_credits_per_month, features, name, slug')
      .eq('id', subscription.plan_id)
      .single()
    
    if (plan && !planError) {
      return {
        ...subscription,
        plan: {
          ...subscription.plan,
          ai_credits_per_month: plan.ai_credits_per_month, // Always use fresh value from DB
          features: plan.features || subscription.plan?.features || subscription.features,
          name: plan.name || subscription.plan?.name,
          slug: plan.slug || subscription.plan?.slug
        }
      }
    }
  }
  
  return subscription
}

/**
 * Get current month credit usage for a user
 */
async function getCurrentMonthCreditUsage(userId: string): Promise<number> {
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

  const { data, error } = await supabase
    .rpc('get_user_credit_usage_current_month', { user_uuid: userId })

  if (error || !data || data.length === 0) {
    return 0
  }

  return data[0].total_credits_used || 0
}

/**
 * Check if user has enough credits for an operation
 */
export async function checkAvailableCredits(
  userId: string,
  requiredCredits: number
): Promise<CreditCheckResult> {
  try {
    // Get user subscription
    const subscription = await getUserSubscription(userId)
    
    // Get credit limit from plan - ALWAYS prioritize plan.ai_credits_per_month (most up-to-date)
    // This ensures test-override changes are immediately reflected
    const limit = subscription?.plan?.ai_credits_per_month !== undefined
      ? subscription.plan.ai_credits_per_month
      : subscription?.features?.ai_credits_per_month !== undefined
      ? subscription.features.ai_credits_per_month
      : 0
    
    // If limit is null (unlimited), allow operation
    if (limit === null) {
      return {
        hasEnough: true,
        available: Infinity,
        used: 0,
        limit: Infinity,
        required: requiredCredits
      }
    }
    
    // Get current month usage
    const used = await getCurrentMonthCreditUsage(userId)
    const available = Math.max(0, limit - used)
    
    return {
      hasEnough: available >= requiredCredits,
      available,
      used,
      limit,
      required: requiredCredits
    }
  } catch (error) {
    console.error('Error checking credits:', error)
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
 * Get credit usage stats for display
 */
export async function getCreditUsageStats(userId: string): Promise<{
  used: number
  limit: number
  available: number
  percentage: number
}> {
  const subscription = await getUserSubscription(userId)
  const limit = subscription?.plan?.ai_credits_per_month !== undefined
    ? subscription.plan.ai_credits_per_month
    : subscription?.features?.ai_credits_per_month !== undefined
    ? subscription.features.ai_credits_per_month
    : subscription?.features?.ai_monthly_limit !== undefined
    ? subscription.features.ai_monthly_limit
    : 0
  
  if (limit === null || limit === Infinity) {
    return {
      used: 0,
      limit: Infinity,
      available: Infinity,
      percentage: 0
    }
  }
  
  const used = await getCurrentMonthCreditUsage(userId)
  const available = Math.max(0, limit - used)
  const percentage = limit > 0 ? (used / limit) * 100 : 0
  
  return {
    used,
    limit,
    available,
    percentage
  }
}
