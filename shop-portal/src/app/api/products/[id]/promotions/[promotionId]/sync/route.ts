import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { extractShopNameFromUrl, getShopRenterAuthHeader, syncProductSpecialToShopRenter, deleteProductSpecialFromShopRenter } from '@/lib/shoprenter-api'

/**
 * POST /api/products/[id]/promotions/[promotionId]/sync
 * Sync a single promotion to ShopRenter
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; promotionId: string }> }
) {
  try {
    const { id, promotionId } = await params
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get promotion
    const { data: promotion, error: promoError } = await supabase
      .from('product_specials')
      .select(`
        *,
        customer_groups (
          id,
          shoprenter_customer_group_id
        )
      `)
      .eq('id', promotionId)
      .eq('product_id', id)
      .is('deleted_at', null)
      .single()

    if (promoError || !promotion) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }

    // Get product and connection
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select('shoprenter_id, connection_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (productError || !product || !product.shoprenter_id) {
      return NextResponse.json({ 
        error: 'Product not found or not synced to ShopRenter' 
      }, { status: 400 })
    }

    // Get connection
    const { data: connection, error: connError } = await supabase
      .from('webshop_connections')
      .select('api_url, username, password')
      .eq('id', product.connection_id)
      .single()

    if (connError || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    // Get auth
    const shopName = extractShopNameFromUrl(connection.api_url)
    if (!shopName) {
      return NextResponse.json({ error: 'Invalid API URL format' }, { status: 400 })
    }

    const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
      shopName,
      connection.username,
      connection.password,
      connection.api_url
    )

    // Get customer group ShopRenter ID if applicable
    let customerGroupShopRenterId: string | null = null
    if (promotion.customer_group_id && promotion.customer_groups) {
      customerGroupShopRenterId = (promotion.customer_groups as any).shoprenter_customer_group_id || null
    }

    // Sync to ShopRenter
    const syncResult = await syncProductSpecialToShopRenter(
      apiBaseUrl,
      authHeader,
      product.shoprenter_id,
      {
        priority: promotion.priority,
        price: parseFloat(promotion.price.toString()),
        dateFrom: promotion.date_from || null,
        dateTo: promotion.date_to || null,
        minQuantity: promotion.min_quantity,
        maxQuantity: promotion.max_quantity,
        type: promotion.type as 'interval' | 'day_spec',
        dayOfWeek: promotion.day_of_week || null,
        customerGroupShopRenterId: customerGroupShopRenterId
      },
      promotion.shoprenter_special_id || null
    )

    if (syncResult.error || !syncResult.shoprenterId) {
      return NextResponse.json({ 
        error: syncResult.error || 'Failed to sync promotion to ShopRenter' 
      }, { status: 500 })
    }

    // Update promotion with ShopRenter ID
    const { error: updateError } = await supabase
      .from('product_specials')
      .update({ shoprenter_special_id: syncResult.shoprenterId })
      .eq('id', promotionId)

    if (updateError) {
      console.error('Error updating promotion with ShopRenter ID:', updateError)
      // Don't fail - sync was successful
    }

    return NextResponse.json({ 
      success: true,
      shoprenter_special_id: syncResult.shoprenterId
    })
  } catch (error) {
    console.error('Error in promotion sync API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/products/[id]/promotions/[promotionId]/sync
 * Delete a promotion from ShopRenter
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; promotionId: string }> }
) {
  try {
    const { id, promotionId } = await params
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get promotion
    const { data: promotion, error: promoError } = await supabase
      .from('product_specials')
      .select('shoprenter_special_id, connection_id')
      .eq('id', promotionId)
      .eq('product_id', id)
      .is('deleted_at', null)
      .single()

    if (promoError || !promotion) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }

    if (!promotion.shoprenter_special_id) {
      return NextResponse.json({ 
        success: true,
        message: 'Promotion not synced to ShopRenter' 
      })
    }

    // Get connection
    const { data: connection, error: connError } = await supabase
      .from('webshop_connections')
      .select('api_url, client_id, client_secret')
      .eq('id', promotion.connection_id)
      .single()

    if (connError || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    // Get auth
    const auth = await getShopRenterAuth(connection.api_url, connection.client_id, connection.client_secret)
    if (!auth.success || !auth.authHeader) {
      return NextResponse.json({ 
        error: `Failed to authenticate with ShopRenter: ${auth.error}` 
      }, { status: 500 })
    }

    // Delete from ShopRenter
    const deleteResult = await deleteProductSpecialFromShopRenter(
      apiBaseUrl,
      authHeader,
      promotion.shoprenter_special_id
    )

    if (!deleteResult.success) {
      return NextResponse.json({ 
        error: deleteResult.error || 'Failed to delete promotion from ShopRenter' 
      }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in promotion delete sync API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
