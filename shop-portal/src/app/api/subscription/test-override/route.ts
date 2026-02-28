import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * POST /api/subscription/test-override
 * Override credit limit for testing (development only)
 */
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

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

    const body = await request.json()
    const { creditLimit } = body

    // Get user's current subscription
    const { data: subscriptionData } = await supabase
      .rpc('get_user_subscription_with_plan', { user_uuid: user.id })

    if (!subscriptionData || subscriptionData.length === 0) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
    }

    const planId = subscriptionData[0].plan_id
    const planSlug = subscriptionData[0].plan_slug

    // Update plan's credit limit temporarily (for testing)
    // Note: This updates the actual plan, so it affects all users with this plan
    // For production, you'd want a separate test_credit_limit column or user-specific override
    const updateValue = creditLimit === null ? null : (creditLimit === '' ? null : parseInt(String(creditLimit)))
    
    // First, reset credit usage for current month (so the new limit is visible)
    const { error: resetError } = await supabase
      .from('ai_usage_logs')
      .delete()
      .eq('user_id', user.id)
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
      .lt('created_at', new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString())

    if (resetError) {
      console.warn('Warning: Could not reset credit usage:', resetError)
      // Continue anyway - the limit update is more important
    } else {
      console.log(`[TEST OVERRIDE] Reset credit usage for current month`)
    }
    
    // Update plan's credit limit
    const { error: updateError } = await supabase
      .from('subscription_plans')
      .update({ 
        ai_credits_per_month: updateValue
      })
      .eq('id', planId)

    if (updateError) {
      console.error('Error updating credit limit:', updateError)
      return NextResponse.json({ 
        error: 'Failed to update credit limit',
        details: updateError.message,
        code: updateError.code
      }, { status: 500 })
    }

    // Verify the update by reading back the plan
    const { data: updatedPlan, error: readError } = await supabase
      .from('subscription_plans')
      .select('ai_credits_per_month, name, slug')
      .eq('id', planId)
      .single()

    if (readError) {
      console.error('Error reading updated plan:', readError)
      // Still return success if update worked but read failed
    }

    console.log(`[TEST OVERRIDE] Updated plan ${planSlug} (${planId}) credit limit to: ${updateValue}`)
    if (updatedPlan) {
      console.log(`[TEST OVERRIDE] Verified: plan now has ${updatedPlan.ai_credits_per_month} credits`)
    }

    return NextResponse.json({
      success: true,
      message: `Credit limit ${updateValue === null ? 'reset to plan default' : `set to ${updateValue}`}. Credit usage also reset.`,
      planId,
      planSlug,
      creditLimit: updateValue,
      verified: updatedPlan?.ai_credits_per_month === updateValue
    })
  } catch (error) {
    console.error('Error in POST /api/subscription/test-override:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to override credit limit'
    }, { status: 500 })
  }
}
