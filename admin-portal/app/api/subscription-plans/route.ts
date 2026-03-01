import { NextRequest, NextResponse } from 'next/server'
import { getAllSubscriptionPlans, createSubscriptionPlan } from '@/lib/supabase-server'

// GET /api/subscription-plans - Get all subscription plans
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const includeInactive = searchParams.get('includeInactive') === 'true'
    
    const plans = await getAllSubscriptionPlans(includeInactive)
    
    return NextResponse.json({ success: true, plans })
  } catch (error: any) {
    console.error('[API] Error fetching subscription plans:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch subscription plans' },
      { status: 500 }
    )
  }
}

// POST /api/subscription-plans - Create new subscription plan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const plan = await createSubscriptionPlan(body)
    
    return NextResponse.json({ success: true, plan }, { status: 201 })
  } catch (error: any) {
    console.error('[API] Error creating subscription plan:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create subscription plan' },
      { status: 500 }
    )
  }
}
