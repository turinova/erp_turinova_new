import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/products/[id]/promotions
 * Get all promotions for a product
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get product to verify it exists and get connection_id
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select('id, connection_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Get all promotions for this product
    const { data: promotions, error } = await supabase
      .from('product_specials')
      .select(`
        *,
        customer_groups (
          id,
          name,
          code
        )
      `)
      .eq('product_id', id)
      .is('deleted_at', null)
      .order('priority', { ascending: false })
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

/**
 * POST /api/products/[id]/promotions
 * Create a new promotion
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get product to verify it exists and get connection_id
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select('id, connection_id, shoprenter_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Validate product is synced to ShopRenter
    if (!product.shoprenter_id || product.shoprenter_id.startsWith('pending-')) {
      return NextResponse.json({ 
        error: 'Product must be synced to ShopRenter before creating promotions' 
      }, { status: 400 })
    }

    // Validate required fields
    if (!body.price || parseFloat(body.price) <= 0) {
      return NextResponse.json({ 
        error: 'Price is required and must be greater than 0' 
      }, { status: 400 })
    }

    // Validate type and day_of_week
    if (body.type === 'day_spec') {
      if (!body.day_of_week || body.day_of_week < 1 || body.day_of_week > 7) {
        return NextResponse.json({ 
          error: 'Day of week must be between 1 (Monday) and 7 (Sunday) for Product of the Day' 
        }, { status: 400 })
      }
      // Force priority to -1 for product of day
      body.priority = -1
    }

    // Validate date range
    if (body.date_from && body.date_to && new Date(body.date_to) < new Date(body.date_from)) {
      return NextResponse.json({ 
        error: 'End date must be after start date' 
      }, { status: 400 })
    }

    // Validate quantity range
    if (body.min_quantity < 0 || body.max_quantity < 0) {
      return NextResponse.json({ 
        error: 'Quantity values cannot be negative' 
      }, { status: 400 })
    }

    if (body.max_quantity > 0 && body.max_quantity < body.min_quantity) {
      return NextResponse.json({ 
        error: 'Maximum quantity must be greater than or equal to minimum quantity' 
      }, { status: 400 })
    }

    // Auto-calculate priority if not provided
    let priority = body.priority
    if (priority === undefined || priority === null) {
      const { data: priorityResult } = await supabase.rpc('get_next_priority_for_product', {
        p_product_id: id
      })
      priority = priorityResult || 1
    }

    // Check for overlapping promotions (warn but don't block)
    const { data: overlapping } = await supabase
      .from('product_specials')
      .select('id, priority, date_from, date_to, min_quantity, max_quantity, customer_group_id')
      .eq('product_id', id)
      .is('deleted_at', null)
      .eq('is_active', true)
      .or(`customer_group_id.eq.${body.customer_group_id || 'null'},customer_group_id.is.null`)

    // Check for date overlaps
    const hasDateOverlap = overlapping?.some(promo => {
      if (!body.date_from || !body.date_to || !promo.date_from || !promo.date_to) {
        return true // If either has no dates, consider it overlapping
      }
      return (
        (new Date(body.date_from) <= new Date(promo.date_to) && 
         new Date(body.date_to) >= new Date(promo.date_from))
      )
    })

    // Check for quantity overlaps
    const hasQuantityOverlap = overlapping?.some(promo => {
      const bodyMin = body.min_quantity || 0
      const bodyMax = body.max_quantity || 0
      const promoMin = promo.min_quantity || 0
      const promoMax = promo.max_quantity || 0

      if (bodyMax === 0 && promoMax === 0) return true // Both unlimited
      if (bodyMax === 0) return promoMin <= bodyMin // Body unlimited
      if (promoMax === 0) return bodyMin <= promoMax // Promo unlimited
      
      return !(bodyMax < promoMin || bodyMin > promoMax)
    })

    // Create promotion
    const promotionData = {
      product_id: id,
      connection_id: product.connection_id,
      customer_group_id: body.customer_group_id || null,
      priority: priority,
      price: parseFloat(body.price),
      date_from: body.date_from || null,
      date_to: body.date_to || null,
      min_quantity: body.min_quantity || 0,
      max_quantity: body.max_quantity || 0,
      type: body.type || 'interval',
      day_of_week: body.type === 'day_spec' ? body.day_of_week : null,
      is_active: true,
      is_expired: false
    }

    const { data: promotion, error: insertError } = await supabase
      .from('product_specials')
      .insert(promotionData)
      .select(`
        *,
        customer_groups (
          id,
          name,
          code
        )
      `)
      .single()

    if (insertError) {
      console.error('Error creating promotion:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Return warning if overlaps detected
    const warnings: string[] = []
    if (hasDateOverlap && hasQuantityOverlap) {
      warnings.push('Ez az akció átfedésben van más akciókkal. A magasabb prioritású nyer.')
    }

    // Note: Auto-sync removed - user must manually sync via the sync button
    // This gives users more control and avoids silent failures

    return NextResponse.json({ 
      success: true, 
      promotion,
      warnings: warnings.length > 0 ? warnings : undefined
    }, { status: 201 })
  } catch (error) {
    console.error('Error in promotions POST API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
