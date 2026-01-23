import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
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

    const { data: accessoryData, error: accessoryError } = await supabaseAdmin
      .from('accessories')
      .select(`
        id,
        name,
        sku,
        base_price,
        multiplier,
        net_price,
        gross_price,
        vat_id,
        currency_id,
        vat (
          id,
          kulcs
        ),
        currencies (
          id,
          name
        )
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (accessoryError) {
      console.error('Error fetching accessory:', accessoryError)
      return NextResponse.json(
        { error: 'Accessory not found' },
        { status: 404 }
      )
    }

    if (!accessoryData) {
      return NextResponse.json(
        { error: 'Accessory not found' },
        { status: 404 }
      )
    }

    // Handle vat and currencies relations (can be array or object)
    const vat = Array.isArray(accessoryData.vat) ? accessoryData.vat[0] : accessoryData.vat
    const currency = Array.isArray(accessoryData.currencies) ? accessoryData.currencies[0] : accessoryData.currencies

    // Use stored gross_price if available, otherwise calculate as fallback
    const vatPercent = vat?.kulcs || 0
    const calculatedGrossPrice = accessoryData.net_price + ((accessoryData.net_price * vatPercent) / 100)
    const finalGrossPrice = accessoryData.gross_price !== null && accessoryData.gross_price !== undefined
      ? accessoryData.gross_price
      : calculatedGrossPrice

    return NextResponse.json({
      id: accessoryData.id,
      name: accessoryData.name,
      sku: accessoryData.sku,
      base_price: accessoryData.base_price,
      multiplier: accessoryData.multiplier,
      net_price: accessoryData.net_price,
      gross_price: finalGrossPrice,
      vat_id: accessoryData.vat_id,
      currency_id: accessoryData.currency_id,
      vat: vat,
      currencies: currency
    })
  } catch (error) {
    console.error('Error in GET /api/accessories/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to fetch accessory' },
      { status: 500 }
    )
  }
}
