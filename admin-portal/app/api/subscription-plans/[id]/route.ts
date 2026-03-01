import { NextRequest, NextResponse } from 'next/server'
import { getSubscriptionPlanById, updateSubscriptionPlan, deleteSubscriptionPlan } from '@/lib/supabase-server'

// GET /api/subscription-plans/[id] - Get subscription plan by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const plan = await getSubscriptionPlanById(id)
    
    if (!plan) {
      return NextResponse.json({ error: 'Subscription plan not found' }, { status: 404 })
    }
    
    return NextResponse.json(plan)
  } catch (error: any) {
    console.error('[API] Error fetching subscription plan:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch subscription plan' },
      { status: 500 }
    )
  }
}

// PUT /api/subscription-plans/[id] - Update subscription plan
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const updatedPlan = await updateSubscriptionPlan(id, body)
    
    return NextResponse.json(updatedPlan, { status: 200 })
  } catch (error: any) {
    console.error('[API] Error updating subscription plan:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update subscription plan' },
      { status: 500 }
    )
  }
}

// DELETE /api/subscription-plans/[id] - Delete subscription plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const result = await deleteSubscriptionPlan(id)
    
    return NextResponse.json({ success: true, ...result }, { status: 200 })
  } catch (error: any) {
    console.error('[API] Error deleting subscription plan:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete subscription plan' },
      { status: 500 }
    )
  }
}
