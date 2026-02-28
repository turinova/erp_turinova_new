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

    // Get user subscription with plan details using the function
    const { data: subscriptionData, error: subError } = await supabase
      .rpc('get_user_subscription_with_plan', { user_uuid: user.id })

    if (subError) {
      console.error('Error fetching subscription:', subError)
      // Return null subscription if not found (user has no subscription)
      return NextResponse.json({
        success: true,
        subscription: null
      })
    }

    if (!subscriptionData || subscriptionData.length === 0) {
      return NextResponse.json({
        success: true,
        subscription: null
      })
    }

    const sub = subscriptionData[0]

    // Get full plan details
    const { data: planData, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', sub.plan_id)
      .single()

    if (planError || !planData) {
      return NextResponse.json({
        success: false,
        error: 'Plan not found'
      }, { status: 404 })
    }

    const subscription: any = {
      id: sub.subscription_id,
      plan_id: sub.plan_id,
      status: sub.status,
      current_period_end: sub.current_period_end,
      plan: {
        id: planData.id,
        name: planData.name,
        slug: planData.slug,
        price_monthly: planData.price_monthly,
        price_yearly: planData.price_yearly,
        features: planData.features,
        ai_credits_per_month: planData.ai_credits_per_month // Include credit limit
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
