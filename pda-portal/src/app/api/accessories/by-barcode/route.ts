import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const barcode = searchParams.get('barcode')

    if (!barcode || !barcode.trim()) {
      return NextResponse.json({ error: 'Barcode is required' }, { status: 400 })
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const trimmedBarcode = barcode.trim()

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

    // Query accessory by barcode - search entire accessories table (no stock requirement)
    // Search in both barcode and barcode_u fields
    const { data: accessoryData, error: accessoryError } = await supabaseAdmin
      .from('accessories')
      .select(`
        id,
        name,
        sku,
        net_price,
        gross_price,
        image_url,
        deleted_at,
        vat (
          id,
          kulcs
        ),
        currencies (
          id,
          name
        )
      `)
      .or(`barcode.eq.${trimmedBarcode},barcode_u.eq.${trimmedBarcode}`)
      .is('deleted_at', null)
      .maybeSingle()

    if (accessoryError) {
      console.error('Error searching accessory by barcode:', accessoryError)
      return NextResponse.json({ error: 'Failed to search by barcode' }, { status: 500 })
    }

    if (!accessoryData) {
      return NextResponse.json({ error: 'Accessory not found' }, { status: 404 })
    }

    // Handle vat and currencies relations (can be array or object)
    const vat = Array.isArray(accessoryData.vat) ? accessoryData.vat[0] : accessoryData.vat
    const currency = Array.isArray(accessoryData.currencies) ? accessoryData.currencies[0] : accessoryData.currencies

    const vatPercent = vat?.kulcs || 0
    // Use stored gross_price if available, otherwise calculate as fallback
    const gross_price = accessoryData.gross_price !== null && accessoryData.gross_price !== undefined
      ? accessoryData.gross_price
      : accessoryData.net_price + ((accessoryData.net_price * vatPercent) / 100)

    return NextResponse.json({
      id: accessoryData.id,
      product_type: 'accessory',
      accessory_id: accessoryData.id,
      name: accessoryData.name,
      sku: accessoryData.sku,
      gross_price: gross_price,
      net_price: accessoryData.net_price,
      currency_name: currency?.name || 'HUF',
      vat_id: vat?.id || '',
      currency_id: currency?.id || '',
      image_url: accessoryData.image_url || null
    })
  } catch (error) {
    console.error('Error in GET /api/accessories/by-barcode:', error)
    return NextResponse.json({ error: 'Failed to fetch accessory by barcode' }, { status: 500 })
  }
}
