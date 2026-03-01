import { NextRequest, NextResponse } from 'next/server'
import { getTenantFromSession, getAdminSupabase, getTenantSupabase } from '@/lib/tenant-supabase'
import { cookies } from 'next/headers'

// POST /api/subscription/purchase-tokens - Purchase token pack (manual flow)
export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromSession()
    if (!tenant) {
      return NextResponse.json({ error: 'Unauthorized - No tenant context' }, { status: 401 })
    }

    const body = await request.json()
    const { tokenPackId } = body

    if (!tokenPackId) {
      return NextResponse.json(
        { success: false, error: 'Token pack ID is required' },
        { status: 400 }
      )
    }

    const adminSupabase = await getAdminSupabase()

    // Get user email from tenant database session
    let userEmail: string | null = null
    try {
      const tenantSupabase = await getTenantSupabase()
      const { data: { user }, error: userError } = await tenantSupabase.auth.getUser()
      if (!userError && user && user.email) {
        userEmail = user.email
      }
    } catch (error) {
      console.warn('Could not fetch user email for purchase log:', error)
      // Continue without user email - not critical
    }

    // Get token pack details
    const { data: tokenPack, error: packError } = await adminSupabase
      .from('token_packs')
      .select('*')
      .eq('id', tokenPackId)
      .eq('is_active', true)
      .single()

    if (packError || !tokenPack) {
      return NextResponse.json(
        { success: false, error: 'Token pack not found or inactive' },
        { status: 404 }
      )
    }

    // Get tenant's current subscription
    const { data: subscription, error: subError } = await adminSupabase
      .from('tenant_subscriptions')
      .select('id, purchased_credits')
      .eq('tenant_id', tenant.id)
      .maybeSingle()

    if (subError || !subscription) {
      return NextResponse.json(
        { success: false, error: 'Tenant subscription not found' },
        { status: 404 }
      )
    }

    // For manual flow: Just add to purchased_credits (admin will process payment separately)
    const currentPurchased = subscription.purchased_credits || 0
    const newPurchased = currentPurchased + tokenPack.credits

    // Update purchased_credits
    const { error: updateError } = await adminSupabase
      .from('tenant_subscriptions')
      .update({ purchased_credits: newPurchased })
      .eq('tenant_id', tenant.id)

    if (updateError) {
      console.error('Error updating purchased credits:', updateError)
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      )
    }

    // Log the purchase (for audit trail)
    const { error: purchaseLogError } = await adminSupabase
      .from('tenant_credit_purchases')
      .insert({
        tenant_id: tenant.id,
        token_pack_id: tokenPackId,
        credits_purchased: tokenPack.credits,
        price_paid_huf: tokenPack.price_huf,
        payment_method: 'manual', // Manual flow - admin processes payment
        purchased_by_user_email: userEmail // Get user email from tenant session
      })

    if (purchaseLogError) {
      console.error('Error logging purchase:', purchaseLogError)
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      success: true,
      message: `${tokenPack.credits} Turitoken hozzáadva! Az adminisztrátor feldolgozza a fizetést.`,
      purchasedCredits: tokenPack.credits,
      newTotalPurchased: newPurchased
    })

  } catch (error) {
    console.error('Error in POST /api/subscription/purchase-tokens:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to purchase tokens'
    }, { status: 500 })
  }
}
