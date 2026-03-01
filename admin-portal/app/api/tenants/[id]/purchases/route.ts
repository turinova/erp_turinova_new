import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

// GET /api/tenants/[id]/purchases - Get credit purchase history for a tenant
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createAdminClient()

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const { data: purchases, error, count } = await supabase
      .from('tenant_credit_purchases')
      .select(`
        id,
        token_pack_id,
        credits_purchased,
        price_paid_huf,
        payment_method,
        stripe_payment_id,
        purchased_by_user_email,
        processed_by_admin_id,
        created_at,
        token_packs (
          id,
          name,
          credits,
          price_huf
        )
      `, { count: 'exact' })
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching purchases:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const formattedPurchases = purchases?.map(purchase => ({
      id: purchase.id,
      token_pack: purchase.token_packs ? {
        id: purchase.token_packs.id,
        name: purchase.token_packs.name,
        credits: purchase.token_packs.credits,
        price_huf: purchase.token_packs.price_huf
      } : null,
      credits_purchased: purchase.credits_purchased,
      price_paid_huf: purchase.price_paid_huf,
      payment_method: purchase.payment_method,
      stripe_payment_id: purchase.stripe_payment_id,
      purchased_by_user_email: purchase.purchased_by_user_email,
      created_at: purchase.created_at
    })) || []

    return NextResponse.json({ success: true, purchases: formattedPurchases, total: count })

  } catch (error) {
    console.error('Error in GET /api/tenants/[id]/purchases:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch purchases'
    }, { status: 500 })
  }
}
