import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { product_type, product_id, new_base_price } = body

    // Validate input
    if (!product_type || !product_id || new_base_price === undefined) {
      return NextResponse.json(
        { error: 'product_type, product_id, and new_base_price are required' },
        { status: 400 }
      )
    }

    if (!['accessory', 'material', 'linear_material'].includes(product_type)) {
      return NextResponse.json(
        { error: 'Invalid product_type. Must be accessory, material, or linear_material' },
        { status: 400 }
      )
    }

    if (typeof new_base_price !== 'number' || new_base_price <= 0) {
      return NextResponse.json(
        { error: 'new_base_price must be a positive number' },
        { status: 400 }
      )
    }

    // Update base_price in the appropriate table
    let tableName: string
    if (product_type === 'accessory') {
      tableName = 'accessories'
    } else if (product_type === 'material') {
      tableName = 'materials'
    } else {
      tableName = 'linear_materials'
    }

    const { data, error } = await supabaseServer
      .from(tableName)
      .update({
        base_price: Math.round(new_base_price),
        updated_at: new Date().toISOString()
      })
      .eq('id', product_id)
      .select('id, base_price')
      .single()

    if (error) {
      console.error(`Error updating ${product_type} base_price:`, error)
      return NextResponse.json(
        { error: `Hiba a ${product_type} base_price frissítésekor: ${error.message}` },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: `${product_type} nem található` },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      product_id: data.id,
      new_base_price: data.base_price
    })
  } catch (error: any) {
    console.error('Error in update-base-price API:', error)
    return NextResponse.json(
      { error: error.message || 'Hiba a base_price frissítésekor' },
      { status: 500 }
    )
  }
}

