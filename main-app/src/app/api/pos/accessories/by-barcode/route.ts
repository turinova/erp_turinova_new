import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const barcode = searchParams.get('barcode')

    if (!barcode || !barcode.trim()) {
      return NextResponse.json({ error: 'Barcode is required' }, { status: 400 })
    }

    const trimmedBarcode = barcode.trim()

    // OPTIMIZED: Query accessory first (fast indexed lookup), then stock
    const { data: accessoryData, error: accessoryError } = await supabaseServer
      .from('accessories')
      .select(`
        id,
        name,
        sku,
        barcode,
        net_price,
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
      .eq('barcode', trimmedBarcode)
      .is('deleted_at', null)
      .maybeSingle()

    if (accessoryError) {
      console.error('Error searching accessory by barcode:', accessoryError)
      return NextResponse.json({ error: 'Failed to search by barcode' }, { status: 500 })
    }

    if (!accessoryData) {
      return NextResponse.json({ error: 'Accessory not found' }, { status: 404 })
    }

    // Now query stock for this specific accessory (fast, indexed lookup)
    const { data: stockData, error: stockError } = await supabaseServer
      .from('current_stock')
      .select('quantity_on_hand')
      .eq('product_type', 'accessory')
      .eq('accessory_id', accessoryData.id)
      .gt('quantity_on_hand', 0)

    if (stockError) {
      console.error('Error fetching stock:', stockError)
      // Still return the accessory even if stock check fails
    }

    // Sum quantity_on_hand across all warehouses
    const quantity_on_hand = (stockData || []).reduce((sum: number, stock: any) => {
      return sum + parseFloat(stock.quantity_on_hand?.toString() || '0')
    }, 0)

    // If no stock found, still return the accessory (user might want to see it)
    // But you can return 404 if you want to enforce stock > 0 requirement
    // if (quantity_on_hand === 0) {
    //   return NextResponse.json({ error: 'Accessory out of stock' }, { status: 404 })
    // }

    const vatPercent = accessoryData.vat?.kulcs || 0
    const gross_price = accessoryData.net_price + ((accessoryData.net_price * vatPercent) / 100)

    return NextResponse.json({
      id: accessoryData.id,
      name: accessoryData.name,
      sku: accessoryData.sku,
      quantity_on_hand: quantity_on_hand,
      gross_price: gross_price,
      net_price: accessoryData.net_price,
      currency_name: accessoryData.currencies?.name || 'HUF',
      vat_id: accessoryData.vat?.id || '',
      currency_id: accessoryData.currencies?.id || '',
      image_url: null
    })
  } catch (error) {
    console.error('Error in POS accessories by-barcode GET:', error)
    return NextResponse.json({ error: 'Failed to fetch accessory by barcode' }, { status: 500 })
  }
}

