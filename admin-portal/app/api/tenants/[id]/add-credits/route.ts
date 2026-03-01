import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// POST /api/tenants/[id]/add-credits - Add bonus credits to tenant's subscription
// FIXED: Now uses bonus_credits instead of modifying plan limit
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { credits } = body

    if (!credits || typeof credits !== 'number' || credits <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid credits amount' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Get tenant's current subscription
    const { data: subscription, error: subError } = await supabase
      .from('tenant_subscriptions')
      .select(`
        id,
        bonus_credits
      `)
      .eq('tenant_id', id)
      .maybeSingle()

    if (subError || !subscription) {
      return NextResponse.json(
        { success: false, error: 'Tenant subscription not found' },
        { status: 404 }
      )
    }

    const currentBonus = subscription.bonus_credits || 0
    const newBonus = currentBonus + credits

    // Update tenant's bonus_credits (tenant-specific, doesn't affect plan)
    const { data: updatedSubscription, error: updateError } = await supabase
      .from('tenant_subscriptions')
      .update({ bonus_credits: newBonus })
      .eq('tenant_id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating tenant bonus credits:', updateError)
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Added ${credits} bonus credits. New bonus total: ${newBonus}`,
      bonusCredits: newBonus
    })

  } catch (error) {
    console.error('Error in POST /api/tenants/[id]/add-credits:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add credits'
    }, { status: 500 })
  }
}
