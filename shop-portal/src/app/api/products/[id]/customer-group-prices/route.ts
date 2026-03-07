import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/products/[id]/customer-group-prices
 * Fetch all customer group prices for a specific product
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getTenantSupabase()
    const { id } = await params

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all customer group prices for this product with customer group details
    const { data: prices, error } = await supabase
      .from('product_customer_group_prices')
      .select(`
        id,
        price,
        is_active,
        shoprenter_customer_group_price_id,
        last_synced_at,
        created_at,
        updated_at,
        customer_group_id,
        customer_groups (
          id,
          name,
          code,
          is_default
        )
      `)
      .eq('product_id', id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching product customer group prices:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a vevőcsoport árak lekérdezésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ prices: prices || [] })
  } catch (error) {
    console.error('Error in product customer group prices API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/products/[id]/customer-group-prices
 * Create a new customer group price for a product
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getTenantSupabase()
    const { id } = await params

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { customer_group_id, price, is_active } = body

    // Validation
    if (!customer_group_id) {
      return NextResponse.json(
        { error: 'Vevőcsoport megadása kötelező' },
        { status: 400 }
      )
    }

    if (price === undefined || price === null || price < 0) {
      return NextResponse.json(
        { error: 'Érvényes ár megadása kötelező' },
        { status: 400 }
      )
    }

    // Check if price already exists for this product and customer group
    const { data: existing } = await supabase
      .from('product_customer_group_prices')
      .select('id')
      .eq('product_id', id)
      .eq('customer_group_id', customer_group_id)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Már létezik ár ehhez a vevőcsoporthoz ehhez a termékhez' },
        { status: 400 }
      )
    }

    // Verify customer group exists
    const { data: customerGroup } = await supabase
      .from('customer_groups')
      .select('id')
      .eq('id', customer_group_id)
      .is('deleted_at', null)
      .single()

    if (!customerGroup) {
      return NextResponse.json(
        { error: 'Vevőcsoport nem található' },
        { status: 404 }
      )
    }

    // Create customer group price
    const { data, error } = await supabase
      .from('product_customer_group_prices')
      .insert({
        product_id: id,
        customer_group_id,
        price: parseFloat(price.toString()),
        is_active: is_active !== undefined ? is_active : true
      })
      .select(`
        *,
        customer_groups (
          id,
          name,
          code,
          is_default
        )
      `)
      .single()

    if (error) {
      console.error('Error creating product customer group price:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a vevőcsoport ár létrehozásakor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ price: data }, { status: 201 })
  } catch (error) {
    console.error('Error in product customer group prices POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
