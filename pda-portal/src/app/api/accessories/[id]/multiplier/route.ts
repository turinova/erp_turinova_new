import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { multiplier, gross_price } = body

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Validate multiplier
    if (typeof multiplier !== 'number' || multiplier < 1.0 || multiplier > 5.0) {
      return NextResponse.json(
        { error: 'Multiplier must be between 1.0 and 5.0' },
        { status: 400 }
      )
    }

    // Validate gross_price if provided
    if (gross_price !== undefined && gross_price !== null) {
      if (typeof gross_price !== 'number' || gross_price < 0) {
        return NextResponse.json(
          { error: 'Gross price must be a positive number' },
          { status: 400 }
        )
      }
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get current accessory to calculate new net_price
    const { data: accessory, error: fetchError } = await supabaseAdmin
      .from('accessories')
      .select('base_price')
      .eq('id', id)
      .single()

    if (fetchError || !accessory) {
      return NextResponse.json(
        { error: 'Accessory not found' },
        { status: 404 }
      )
    }

    // Calculate new net_price from base_price and multiplier
    const net_price = Math.round(accessory.base_price * multiplier)

    // Build update object
    const updateData: any = {
      multiplier: parseFloat(multiplier.toFixed(3)),
      net_price: net_price,
      updated_at: new Date().toISOString()
    }

    // Add gross_price if provided (preserves user-entered value)
    if (gross_price !== undefined && gross_price !== null) {
      updateData.gross_price = Math.round(gross_price)
    }

    // Update multiplier, net_price, and optionally gross_price
    const { data, error } = await supabaseAdmin
      .from('accessories')
      .update(updateData)
      .eq('id', id)
      .select('id, multiplier, net_price, gross_price')
      .single()

    if (error) {
      console.error('Error updating multiplier:', error)
      return NextResponse.json(
        { error: 'Failed to update multiplier' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      accessory: data
    })
  } catch (error) {
    console.error('Error in PATCH /api/accessories/[id]/multiplier:', error)
    return NextResponse.json(
      { error: 'Failed to update multiplier' },
      { status: 500 }
    )
  }
}
