import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { resolveAccessorySellingGross } from '@/lib/accessory-selling-price'

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
    const barcodesToTry = Array.from(
      new Set([trimmedBarcode, trimmedRawBarcode].filter((value): value is string => Boolean(value)))
    )

    const accessorySelect = `
      id,
      name,
      sku,
      net_price,
      gross_price,
      base_price,
      image_url,
      deleted_at,
      partners_id,
      units_id,
      vat (
        id,
        kulcs
      ),
      currencies (
        id,
        name
      )
    `

    let accessoryData: any = null
    for (const code of barcodesToTry) {
      const { data, error } = await supabaseServer
        .from('accessories')
        .select(accessorySelect)
        .or(`barcode.eq.${code},barcode_u.eq.${code}`)
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

        // Now query stock for this specific accessory (fast, indexed lookup) - including negative quantities
        const { data: stockData, error: stockError } = await supabaseServer
          .from('current_stock')
          .select('quantity_on_hand')
          .eq('product_type', 'accessory')
          .eq('accessory_id', accessoryData.id)

    let quantity_on_hand = 0
    if (stockError) {
      // Keep scan flow functional even if stock view has issues.
      console.error('Error fetching stock for scanned accessory:', stockError)
    } else if (stockData && stockData.length > 0) {
      // Sum quantity_on_hand across all warehouses (including negative quantities)
      quantity_on_hand = stockData.reduce((sum: number, stock: any) => {
        return sum + parseFloat(stock.quantity_on_hand?.toString() || '0')
      }, 0)
    }

    const vatPercent = accessoryData.vat?.kulcs || 0
    const gross_price = resolveAccessorySellingGross({
      netPrice: accessoryData.net_price,
      grossPriceFromDb: accessoryData.gross_price,
      vatKulcs: vatPercent,
    })

    return NextResponse.json({
      id: accessoryData.id,
      product_type: 'accessory',
      accessory_id: accessoryData.id,
      name: accessoryData.name,
      sku: accessoryData.sku,
      quantity_on_hand: quantity_on_hand,
      gross_price: gross_price,
      net_price: accessoryData.net_price,
      base_price: accessoryData.base_price || 0,
      partners_id: accessoryData.partners_id || null,
      units_id: accessoryData.units_id || null,
      currency_name: accessoryData.currencies?.name || 'HUF',
      vat_id: accessoryData.vat?.id || '',
      currency_id: accessoryData.currencies?.id || '',
      image_url: accessoryData.image_url || null
    })
  } catch (error) {
    console.error('Error in POS accessories by-barcode GET:', error)
    return NextResponse.json({ error: 'Failed to fetch accessory by barcode' }, { status: 500 })
  }
}

