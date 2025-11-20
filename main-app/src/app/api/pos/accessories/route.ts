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
    const resultLimit = 50 // Limit results for performance

    // Step 1: Get all accessories from current_stock view (including negative quantities)
    const { data: accessoryStockData, error: accessoryStockError } = await supabaseServer
      .from('current_stock')
      .select('accessory_id, quantity_on_hand')
      .eq('product_type', 'accessory')
      .not('accessory_id', 'is', null)

    if (accessoryStockError) {
      console.error('Error fetching accessory stock:', accessoryStockError)
    }

    // Sum quantities per accessory
    const accessoryStockMap = new Map<string, number>()
    accessoryStockData?.forEach((stock: any) => {
      const accId = stock.accessory_id
      const qty = parseFloat(stock.quantity_on_hand?.toString() || '0')
      accessoryStockMap.set(accId, (accessoryStockMap.get(accId) || 0) + qty)
    })

    const accessoryIdsWithStock = Array.from(accessoryStockMap.keys())

    // Step 2: Search accessories by name and SKU, but only those with stock
    const [accessoryNameResult, accessorySkuResult, materialResult, linearMaterialResult] = await Promise.all([
      // Search accessories by name - only those with stock
      accessoryIdsWithStock.length > 0
        ? supabaseServer
            .from('accessories')
            .select(`
              id,
              name,
              sku,
              net_price,
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
            .in('id', accessoryIdsWithStock)
            .ilike('name', `%${trimmedSearch}%`)
            .is('deleted_at', null)
            .limit(resultLimit)
        : Promise.resolve({ data: [], error: null }),
      // Search accessories by SKU - only those with stock
      accessoryIdsWithStock.length > 0
        ? supabaseServer
            .from('accessories')
            .select(`
              id,
              name,
              sku,
              net_price,
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
            .in('id', accessoryIdsWithStock)
            .ilike('sku', `%${trimmedSearch}%`)
            .is('deleted_at', null)
            .limit(resultLimit)
        : Promise.resolve({ data: [], error: null }),
      // Search materials by name
      supabaseServer
        .from('current_stock')
        .select(`
          product_type,
          accessory_id,
          material_id,
          linear_material_id,
          quantity_on_hand,
          materials!inner (
            id,
            name,
            length_mm,
            width_mm,
            thickness_mm,
            base_price,
            multiplier,
            deleted_at,
            image_url,
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
        .eq('product_type', 'material')
        .not('material_id', 'is', null)
        .ilike('materials.name', `%${trimmedSearch}%`)
        .is('materials.deleted_at', null)
        .limit(resultLimit),
      // Search linear_materials by name
      supabaseServer
        .from('current_stock')
        .select(`
          product_type,
          accessory_id,
          material_id,
          linear_material_id,
          quantity_on_hand,
          linear_materials!inner (
            id,
            name,
            length,
            width,
            thickness,
            base_price,
            multiplier,
            deleted_at,
            image_url,
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
        .eq('product_type', 'linear_material')
        .not('linear_material_id', 'is', null)
        .ilike('linear_materials.name', `%${trimmedSearch}%`)
        .is('linear_materials.deleted_at', null)
        .limit(resultLimit)
    ])

    // Check for errors
    if (accessoryNameResult.error) {
      console.error('Error searching accessories by name:', accessoryNameResult.error)
    }
    if (accessorySkuResult.error) {
      console.error('Error searching accessories by SKU:', accessorySkuResult.error)
    }
    if (materialResult.error) {
      console.error('Error searching materials:', materialResult.error)
    }
    if (linearMaterialResult.error) {
      console.error('Error searching linear materials:', linearMaterialResult.error)
    }

    // Merge accessory results and deduplicate
    const accessoryMap = new Map<string, any>()
    ;[...(accessoryNameResult.data || []), ...(accessorySkuResult.data || [])].forEach((acc: any) => {
      if (!acc.deleted_at) {
        accessoryMap.set(acc.id, acc)
      }
    })
    const uniqueAccessories = Array.from(accessoryMap.values())

    // Merge all results
    const allResults: any[] = [
      // Add accessories with stock info
      ...uniqueAccessories.map(acc => ({
        product_type: 'accessory',
        accessory_id: acc.id,
        quantity_on_hand: accessoryStockMap.get(acc.id) || 0,
        accessories: acc
      })),
      // Materials and linear_materials from current_stock
      ...(materialResult.data || []),
      ...(linearMaterialResult.data || [])
    ]

    // Group by product type and ID, sum quantities
    const groupedProducts = new Map<string, {
      product_type: string
      id: string
      quantity_on_hand: number
      product: any
      material_id?: string | null
      linear_material_id?: string | null
      accessory_id?: string | null
    }>()

    allResults.forEach((item: any) => {
      let productId: string
      let product: any
      let productType = item.product_type

      if (productType === 'accessory' && item.accessories) {
        productId = item.accessory_id
        product = item.accessories
        if (!product || product.deleted_at) return
      } else if (productType === 'material' && item.materials) {
        productId = item.material_id
        product = item.materials
        if (!product || product.deleted_at) return
      } else if (productType === 'linear_material' && item.linear_materials) {
        productId = item.linear_material_id
        product = item.linear_materials
        if (!product || product.deleted_at) return
      } else {
        return
      }

      const key = `${productType}_${productId}`
      const quantity = parseFloat(item.quantity_on_hand.toString())

      if (groupedProducts.has(key)) {
        const existing = groupedProducts.get(key)!
        existing.quantity_on_hand += quantity
      } else {
        groupedProducts.set(key, {
          product_type: productType,
          id: productId,
          quantity_on_hand: quantity,
          product: product,
          material_id: item.material_id || null,
          linear_material_id: item.linear_material_id || null,
          accessory_id: item.accessory_id || null
        })
      }
    })

    // Transform to final format
    const productsWithInventory = Array.from(groupedProducts.values()).map((item) => {
      const product = item.product
      const vatPercent = product.vat?.kulcs || 0
      let gross_price = 0
      let net_price = 0

      if (item.product_type === 'accessory') {
        net_price = product.net_price || 0
        gross_price = net_price + ((net_price * vatPercent) / 100)
      } else if (item.product_type === 'material') {
        // Materials: base_price * (length_mm * width_mm / 1000000) * multiplier * (1 + vat_percent/100)
        const areaSqm = (product.length_mm * product.width_mm) / 1000000
        net_price = product.base_price * areaSqm * product.multiplier
        gross_price = net_price * (1 + vatPercent / 100)
      } else if (item.product_type === 'linear_material') {
        // Linear materials: (length / 1000) * base_price * multiplier * (1 + vat_percent/100)
        const lengthM = product.length / 1000
        net_price = lengthM * product.base_price * product.multiplier
        gross_price = net_price * (1 + vatPercent / 100)
      }

      const result: any = {
        id: item.id,
        product_type: item.product_type,
        name: product.name,
        quantity_on_hand: item.quantity_on_hand,
        gross_price: gross_price,
        net_price: net_price,
        currency_name: product.currencies?.name || 'HUF',
        vat_id: product.vat?.id || '',
        currency_id: product.currencies?.id || '',
        image_url: null // Default to null
      }

      if (item.product_type === 'accessory') {
        result.sku = product.sku || ''
        result.accessory_id = item.accessory_id
        result.image_url = product.image_url || null // Accessories now have image_url column
      } else if (item.product_type === 'material') {
        result.material_id = item.material_id
        result.length_mm = product.length_mm
        result.width_mm = product.width_mm
        result.thickness_mm = product.thickness_mm
        result.image_url = product.image_url || null // Materials have image_url
      } else if (item.product_type === 'linear_material') {
        result.linear_material_id = item.linear_material_id
        result.length = product.length
        result.width = product.width
        result.thickness = product.thickness
        result.image_url = product.image_url || null // Linear materials have image_url
      }

      return result
    })

    return NextResponse.json(productsWithInventory)
  } catch (error) {
    console.error('Error in POS products GET:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

