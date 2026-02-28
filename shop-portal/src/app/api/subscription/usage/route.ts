import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current month credit usage
    const { data: creditUsageData, error: creditUsageError } = await supabase
      .rpc('get_user_credit_usage_current_month', { user_uuid: user.id })

    // Get current month token usage (for backward compatibility)
    const { data: usageData, error: usageError } = await supabase
      .rpc('get_user_ai_usage_current_month', { user_uuid: user.id })

    if (usageError && creditUsageError) {
      console.error('Error fetching usage:', usageError || creditUsageError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch usage'
      }, { status: 500 })
    }

    const totalTokens = usageData?.[0]?.total_tokens || 0
    const totalCost = usageData?.[0]?.total_cost || 0
    const usageCount = usageData?.[0]?.usage_count || 0
    const totalCreditsUsed = creditUsageData?.[0]?.total_credits_used || 0

    // Get user subscription to determine limit
    const { data: subscriptionData } = await supabase
      .rpc('get_user_subscription_with_plan', { user_uuid: user.id })

    let monthlyLimit: number | null = null
    let creditLimit: number | null = null
    let fullPlanData: any = null
    
    if (subscriptionData && subscriptionData.length > 0) {
      const features = subscriptionData[0].features
      monthlyLimit = features?.ai_monthly_limit || null
      
      // Get full plan data including ai_credits_per_month
      const { data: planData } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', subscriptionData[0].plan_id)
        .single()
      
      creditLimit = planData?.ai_credits_per_month || null
      fullPlanData = planData
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
      subscription: subscriptionData && subscriptionData.length > 0 ? {
        ...subscriptionData[0],
        plan: fullPlanData ? {
          ...fullPlanData,
          features: subscriptionData[0].features
        } : null
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
