import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/tenant-supabase'

export async function GET(request: NextRequest) {
  try {
    // Get plans from Admin DB (subscription plans are managed there)
    const adminSupabase = await getAdminSupabase()

    console.log('[PLANS API] Fetching subscription plans from Admin DB')

    // Get all active plans
    const { data: plans, error: plansError } = await adminSupabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    console.log('[PLANS API] Query result:', {
      hasData: !!plans,
      count: plans?.length || 0,
      hasError: !!plansError,
      error: plansError
    })

    if (plansError) {
      console.error('[PLANS API] Error fetching subscription plans:', plansError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch plans'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      plans: plans || []
    })
  } catch (error) {
    console.error('Error in GET /api/subscription/plans:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch plans'
    }, { status: 500 })
  }
}
