import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchTerm = searchParams.get('search') || ''

    if (!searchTerm || !searchTerm.trim()) {
      // No search term - return empty
      return NextResponse.json([])
    }

    const trimmedSearch = searchTerm.trim()

    // Query current_stock view joined with accessories table
    // This ensures we only get accessories that have stock movements
    // Use separate queries for name and sku to avoid PostgREST parsing issues
    
    // Search by name - query current_stock and join accessories
    const { data: nameStockResults } = await supabaseServer
      .from('current_stock')
      .select(`
        accessory_id,
        quantity_on_hand,
        accessories!inner (
          id,
          name,
          sku,
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
        )
      `)
      .eq('product_type', 'accessory')
      .not('accessory_id', 'is', null)
      .gt('quantity_on_hand', 0) // Only show items with stock > 0
      .ilike('accessories.name', `%${trimmedSearch}%`)
      .is('accessories.deleted_at', null)

    // Search by SKU - query current_stock and join accessories
    const { data: skuStockResults } = await supabaseServer
      .from('current_stock')
      .select(`
        accessory_id,
        quantity_on_hand,
        accessories!inner (
          id,
          name,
          sku,
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
        )
      `)
      .eq('product_type', 'accessory')
      .not('accessory_id', 'is', null)
      .gt('quantity_on_hand', 0) // Only show items with stock > 0
      .ilike('accessories.sku', `%${trimmedSearch}%`)
      .is('accessories.deleted_at', null)

    // Merge and group by accessory_id, summing quantity_on_hand
    const allResults = [...(nameStockResults || []), ...(skuStockResults || [])]
    
    // Group by accessory_id and sum quantities
    const groupedByAccessory = new Map<string, {
      accessory_id: string
      quantity_on_hand: number
      accessory: any
    }>()

    allResults.forEach((item: any) => {
      const accessoryId = item.accessory_id
      const accessory = item.accessories
      
      if (!accessory || accessory.deleted_at) return

      if (groupedByAccessory.has(accessoryId)) {
        const existing = groupedByAccessory.get(accessoryId)!
        existing.quantity_on_hand += parseFloat(item.quantity_on_hand.toString())
      } else {
        groupedByAccessory.set(accessoryId, {
          accessory_id: accessoryId,
          quantity_on_hand: parseFloat(item.quantity_on_hand.toString()),
          accessory: accessory
        })
      }
    })

    // Transform to final format
    const accessoriesWithInventory = Array.from(groupedByAccessory.values()).map((item) => {
      const accessory = item.accessory
      const vatPercent = accessory.vat?.kulcs || 0
      const gross_price = accessory.net_price + ((accessory.net_price * vatPercent) / 100)

      return {
        id: accessory.id,
        name: accessory.name,
        sku: accessory.sku,
        quantity_on_hand: item.quantity_on_hand,
        gross_price: gross_price,
        net_price: accessory.net_price,
        currency_name: accessory.currencies?.name || 'HUF',
        image_url: null
      }
    })

    return NextResponse.json(accessoriesWithInventory)
  } catch (error) {
    console.error('Error in POS accessories GET:', error)
    return NextResponse.json({ error: 'Failed to fetch accessories' }, { status: 500 })
  }
}

