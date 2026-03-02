import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase, getAdminSupabase, getTenantFromSession } from '@/lib/tenant-supabase'

/**
 * POST /api/subscription/test-override
 * Override credit limit for testing (development only)
 * NOTE: This route uses tenant-level subscriptions in Admin DB
 */
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get tenant context
    const tenant = await getTenantFromSession()
    if (!tenant) {
      return NextResponse.json({ error: 'No tenant context' }, { status: 401 })
    }

    // Use Admin DB for tenant subscriptions
    const adminSupabase = await getAdminSupabase()

    const body = await request.json()
    const { creditLimit } = body

    // Get tenant's current subscription from Admin DB
    const { data: subscriptionData, error: subError } = await adminSupabase
      .from('tenant_subscriptions')
      .select(`
        *,
        subscription_plans (*)
      `)
      .eq('tenant_id', tenant.id)
      .eq('status', 'active')
      .maybeSingle()

    if (subError || !subscriptionData) {
      return NextResponse.json({ error: 'No active subscription found for tenant' }, { status: 404 })
    }

    const planId = subscriptionData.plan_id
    const plan = subscriptionData.subscription_plans as any
    const planSlug = plan?.slug || 'unknown'

    // Update plan's credit limit temporarily (for testing)
    // Note: This updates the actual plan in Admin DB, so it affects all tenants with this plan
    const updateValue = creditLimit === null ? null : (creditLimit === '' ? null : parseInt(String(creditLimit)))
    
    // Update plan's credit limit in Admin DB
    const { error: updateError } = await adminSupabase
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
    const { data: updatedPlan, error: readError } = await adminSupabase
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
      message: `Credit limit ${updateValue === null ? 'reset to plan default' : `set to ${updateValue}`}`,
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
