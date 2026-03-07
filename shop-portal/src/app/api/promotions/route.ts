import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/promotions
 * Get all promotions across all products
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all promotions with product and customer group info
    const { data: promotions, error } = await supabase
      .from('product_specials')
      .select(`
        *,
        shoprenter_products (
          id,
          name,
          sku,
          shoprenter_id
        ),
        customer_groups (
          id,
          name,
          code
        )
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching promotions:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      promotions: promotions || [] 
    })
  } catch (error) {
    console.error('Error in promotions GET API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
