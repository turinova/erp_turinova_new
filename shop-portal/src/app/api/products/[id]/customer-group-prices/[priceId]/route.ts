import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * PUT /api/products/[id]/customer-group-prices/[priceId]
 * Update an existing customer group price for a product
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; priceId: string }> }
) {
  try {
    const supabase = await getTenantSupabase()
    const { id, priceId } = await params

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { price, is_active } = body

    // Validation
    if (price === undefined || price === null || price < 0) {
      return NextResponse.json(
        { error: 'Érvényes ár megadása kötelező' },
        { status: 400 }
      )
    }

    // Update customer group price
    const { data, error } = await supabase
      .from('product_customer_group_prices')
      .update({
        price: parseFloat(price.toString()),
        is_active: is_active !== undefined ? is_active : true,
        updated_at: new Date().toISOString()
      })
      .eq('id', priceId)
      .eq('product_id', id)
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
      console.error('Error updating product customer group price:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a vevőcsoport ár frissítésekor' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Vevőcsoport ár nem található' },
        { status: 404 }
      )
    }

    return NextResponse.json({ price: data })
  } catch (error) {
    console.error('Error in product customer group prices PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/products/[id]/customer-group-prices/[priceId]
 * Delete a customer group price for a product
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; priceId: string }> }
) {
  try {
    const supabase = await getTenantSupabase()
    const { id, priceId } = await params

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete customer group price
    const { error } = await supabase
      .from('product_customer_group_prices')
      .delete()
      .eq('id', priceId)
      .eq('product_id', id)

    if (error) {
      console.error('Error deleting product customer group price:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a vevőcsoport ár törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in product customer group prices DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
