import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { extractShopNameFromUrl, getShopRenterAuthHeader, syncProductSpecialToShopRenter, deleteProductSpecialFromShopRenter } from '@/lib/shoprenter-api'

/**
 * PUT /api/products/[id]/promotions/[promotionId]
 * Update an existing promotion
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; promotionId: string }> }
) {
  try {
    const { id, promotionId } = await params
    const body = await request.json()
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get existing promotion
    const { data: existingPromotion, error: fetchError } = await supabase
      .from('product_specials')
      .select('*')
      .eq('id', promotionId)
      .eq('product_id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !existingPromotion) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }

    // Validate price if provided
    if (body.price !== undefined && parseFloat(body.price) <= 0) {
      return NextResponse.json({ 
        error: 'Price must be greater than 0' 
      }, { status: 400 })
    }

    // Validate type and day_of_week
    const promotionType = body.type !== undefined ? body.type : existingPromotion.type
    if (promotionType === 'day_spec') {
      const dayOfWeek = body.day_of_week !== undefined ? body.day_of_week : existingPromotion.day_of_week
      if (!dayOfWeek || dayOfWeek < 1 || dayOfWeek > 7) {
        return NextResponse.json({ 
          error: 'Day of week must be between 1 (Monday) and 7 (Sunday) for Product of the Day' 
        }, { status: 400 })
      }
      // Force priority to -1 for product of day
      body.priority = -1
    }

    // Validate date range
    const dateFrom = body.date_from !== undefined ? body.date_from : existingPromotion.date_from
    const dateTo = body.date_to !== undefined ? body.date_to : existingPromotion.date_to
    if (dateFrom && dateTo && new Date(dateTo) < new Date(dateFrom)) {
      return NextResponse.json({ 
        error: 'End date must be after start date' 
      }, { status: 400 })
    }

    // Validate quantity range
    const minQty = body.min_quantity !== undefined ? body.min_quantity : existingPromotion.min_quantity
    const maxQty = body.max_quantity !== undefined ? body.max_quantity : existingPromotion.max_quantity
    if (minQty < 0 || maxQty < 0) {
      return NextResponse.json({ 
        error: 'Quantity values cannot be negative' 
      }, { status: 400 })
    }
    if (maxQty > 0 && maxQty < minQty) {
      return NextResponse.json({ 
        error: 'Maximum quantity must be greater than or equal to minimum quantity' 
      }, { status: 400 })
    }

    // Check if customer group changed to "Everyone" (null)
    // ShopRenter requires delete + recreate in this case
    const customerGroupChanged = 
      (existingPromotion.customer_group_id !== null && (body.customer_group_id === null || body.customer_group_id === '')) ||
      (existingPromotion.customer_group_id === null && body.customer_group_id !== null && body.customer_group_id !== '')

    // Prepare update data
    const updateData: any = {}
    if (body.price !== undefined) updateData.price = parseFloat(body.price)
    if (body.priority !== undefined) updateData.priority = body.priority
    if (body.date_from !== undefined) updateData.date_from = body.date_from || null
    if (body.date_to !== undefined) updateData.date_to = body.date_to || null
    if (body.min_quantity !== undefined) updateData.min_quantity = body.min_quantity || 0
    if (body.max_quantity !== undefined) updateData.max_quantity = body.max_quantity || 0
    if (body.type !== undefined) {
      updateData.type = body.type
      updateData.day_of_week = body.type === 'day_spec' ? body.day_of_week : null
    }
    if (body.customer_group_id !== undefined) {
      updateData.customer_group_id = body.customer_group_id || null
    }
    if (body.is_active !== undefined) updateData.is_active = body.is_active

    // If customer group changed to "Everyone", we need to delete and recreate
    // This will be handled in the sync logic
    if (customerGroupChanged && existingPromotion.shoprenter_special_id) {
      // Mark for recreation
      updateData.shoprenter_special_id = null
    }

    // Update promotion
    const { data: promotion, error: updateError } = await supabase
      .from('product_specials')
      .update(updateData)
      .eq('id', promotionId)
      .select(`
        *,
        customer_groups (
          id,
          name,
          code
        )
      `)
      .single()

    if (updateError) {
      console.error('Error updating promotion:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Note: Auto-sync removed - user must manually sync via the sync button
    // This gives users more control and avoids silent failures

    return NextResponse.json({ 
      success: true, 
      promotion,
      requires_recreation: customerGroupChanged // Signal to sync logic
    })
  } catch (error) {
    console.error('Error in promotions PUT API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/products/[id]/promotions/[promotionId]
 * Delete (soft delete) a promotion
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

    // Verify promotion exists
    const { data: promotion, error: fetchError } = await supabase
      .from('product_specials')
      .select('id, shoprenter_special_id')
      .eq('id', promotionId)
      .eq('product_id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !promotion) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }

    // Delete from ShopRenter first if synced
    if (promotion.shoprenter_special_id) {
      try {
        const { data: product } = await supabase
          .from('shoprenter_products')
          .select('connection_id')
          .eq('id', id)
          .single()

        if (product) {
          const { data: connection } = await supabase
            .from('webshop_connections')
            .select('api_url, username, password')
            .eq('id', product.connection_id)
            .single()

          if (connection) {
            const shopName = extractShopNameFromUrl(connection.api_url)
            if (shopName) {
              const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
                shopName,
                connection.username,
                connection.password,
                connection.api_url
              )
              
              await deleteProductSpecialFromShopRenter(
                apiBaseUrl,
                authHeader,
                promotion.shoprenter_special_id
              )
            }
          }
        }
      } catch (syncError) {
        console.error('Error deleting promotion from ShopRenter:', syncError)
        // Continue with local deletion even if ShopRenter delete fails
      }
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from('product_specials')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', promotionId)

    if (deleteError) {
      console.error('Error deleting promotion:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      shoprenter_special_id: promotion.shoprenter_special_id // Return for ShopRenter deletion
    })
  } catch (error) {
    console.error('Error in promotions DELETE API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
