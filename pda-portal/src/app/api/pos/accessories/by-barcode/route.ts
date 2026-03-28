import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAccessorySellingGrossFromRow } from '@/lib/accessory-selling-price'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const barcode = searchParams.get('barcode')
    const rawBarcode = searchParams.get('raw_barcode')

    if (!barcode || !barcode.trim()) {
      return NextResponse.json({ error: 'Barcode is required' }, { status: 400 })
    }

    const trimmedBarcode = barcode.trim()
    const trimmedRawBarcode = rawBarcode?.trim()

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Query accessory by barcode - search in both barcode and barcode_u fields
    // Try both normalized and raw barcode candidates.
    const candidates = [trimmedBarcode]
    if (trimmedRawBarcode && trimmedRawBarcode !== trimmedBarcode) {
      candidates.push(trimmedRawBarcode)
    }

    let accessoryData: any = null
    for (const candidate of candidates) {
      const { data, error } = await supabaseAdmin
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
        .or(`barcode.eq.${candidate},barcode_u.eq.${candidate}`)
        .is('deleted_at', null)
        .maybeSingle()

      if (error) {
        console.error('Error searching accessory by barcode:', error)
        return NextResponse.json({ error: 'Failed to search by barcode' }, { status: 500 })
      }

      if (data) {
        accessoryData = data
        break
      }
    }

    if (!accessoryData) {
      return NextResponse.json({ error: 'Accessory not found' }, { status: 404 })
    }

    // Query stock for this accessory (including negative quantities)
    const { data: stockData, error: stockError } = await supabaseAdmin
      .from('current_stock')
      .select('quantity_on_hand')
      .eq('product_type', 'accessory')
      .eq('accessory_id', accessoryData.id)

    if (stockError) {
      console.error('Error fetching stock:', stockError)
    }

    // Sum quantity_on_hand across all warehouses
    const quantity_on_hand = (stockData || []).reduce((sum: number, stock: any) => {
      return sum + parseFloat(stock.quantity_on_hand?.toString() || '0')
    }, 0)

    // Handle vat and currencies relations (can be array or object)
    const vat = Array.isArray(accessoryData.vat) ? accessoryData.vat[0] : accessoryData.vat
    const currency = Array.isArray(accessoryData.currencies) ? accessoryData.currencies[0] : accessoryData.currencies

    const { gross_price } = resolveAccessorySellingGrossFromRow(accessoryData)

    return NextResponse.json({
      id: accessoryData.id,
      product_type: 'accessory',
      accessory_id: accessoryData.id,
      name: accessoryData.name,
      sku: accessoryData.sku,
      quantity_on_hand: quantity_on_hand,
      gross_price: gross_price,
      net_price: accessoryData.net_price,
      currency_name: currency?.name || 'HUF',
      vat_id: vat?.id || '',
      currency_id: currency?.id || '',
      image_url: accessoryData.image_url || null
    })
  } catch (error) {
    console.error('Error in POS accessories by-barcode GET:', error)
    return NextResponse.json({ error: 'Failed to fetch accessory by barcode' }, { status: 500 })
  }
}

