import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { multiplier } = body

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

    // Update only multiplier and net_price
    const { data, error } = await supabaseAdmin
      .from('accessories')
      .update({
        multiplier: parseFloat(multiplier.toFixed(2)),
        net_price: net_price,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('id, multiplier, net_price')
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
