import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAccessorySellingGrossFromRow } from '@/lib/accessory-selling-price'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchTerm = searchParams.get('search') || ''

    if (!searchTerm || !searchTerm.trim()) {
      return NextResponse.json([])
    }

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

    const trimmedSearch = searchTerm.trim()
    const resultLimit = 20
    const fuzzy = `%${trimmedSearch}%`

    const [accessoriesResult, materialsResult, linearMaterialsResult, materialStockResult] = await Promise.all([
      // Match main POS behavior: no stock gate for accessories, search by name/sku/barcode/barcode_u
      supabaseAdmin
        .from('accessories')
        .select(`
          id,
          name,
          sku,
          net_price,
          gross_price,
          image_url,
          units_id,
          vat (
            id,
            kulcs
          ),
          currencies (
            id,
            name
          ),
          units:units_id (
            id,
            name,
            shortform
          )
        `)
        .or(`name.ilike.${fuzzy},sku.ilike.${fuzzy},barcode.ilike.${fuzzy},barcode_u.ilike.${fuzzy}`)
        .is('deleted_at', null)
        .limit(resultLimit),
      // Materials: name only
      supabaseAdmin
        .from('materials')
        .select(`
          id,
          name,
          length_mm,
          width_mm,
          thickness_mm,
          base_price,
          multiplier,
          image_url,
          vat (
            id,
            kulcs
          ),
          currencies (
            id,
            name
          )
        `)
        .ilike('name', fuzzy)
        .is('deleted_at', null)
        .limit(resultLimit),
      // Linear materials: name only
      supabaseAdmin
        .from('linear_materials')
        .select(`
          id,
          name,
          length,
          width,
          thickness,
          base_price,
          multiplier,
          image_url,
          vat (
            id,
            kulcs
          ),
          currencies (
            id,
            name
          )
        `)
        .ilike('name', fuzzy)
        .is('deleted_at', null)
        .limit(resultLimit),
      // Stock shown only for materials
      supabaseAdmin
        .from('current_stock')
        .select('material_id, quantity_on_hand')
        .eq('product_type', 'material')
        .not('material_id', 'is', null)
    ])

    if (accessoriesResult.error) console.error('Error searching accessories:', accessoriesResult.error)
    if (materialsResult.error) console.error('Error searching materials:', materialsResult.error)
    if (linearMaterialsResult.error) console.error('Error searching linear materials:', linearMaterialsResult.error)
    if (materialStockResult.error) console.error('Error fetching material stock:', materialStockResult.error)

    const materialStockMap = new Map<string, number>()
    ;(materialStockResult.data || []).forEach((row: any) => {
      const matId = row.material_id
      if (!matId) return
      const qty = parseFloat(row.quantity_on_hand?.toString() || '0')
      materialStockMap.set(matId, (materialStockMap.get(matId) || 0) + qty)
    })

    const accessories = (accessoriesResult.data || []).map((product: any) => {
      const netPrice = Number(product.net_price || 0)
      const { gross_price: grossPrice } = resolveAccessorySellingGrossFromRow(product)

      return {
        id: product.id,
        product_type: 'accessory',
        name: product.name,
        sku: product.sku || '',
        accessory_id: product.id,
        quantity_on_hand: 0,
        gross_price: grossPrice,
        net_price: netPrice,
        currency_name: product.currencies?.name || 'HUF',
        vat_id: product.vat?.id || '',
        currency_id: product.currencies?.id || '',
        image_url: product.image_url || null,
        unit_name: Array.isArray(product.units) ? product.units[0]?.name : product.units?.name,
        unit_shortform: Array.isArray(product.units) ? product.units[0]?.shortform : product.units?.shortform
      }
    })

    const materials = (materialsResult.data || []).map((product: any) => {
      const vatPercent = product.vat?.kulcs || 0
      const basePrice = Number(product.base_price || 0)
      const multiplier = Number(product.multiplier || 1.38)
      const unitPricePerSqm = basePrice * multiplier * (1 + vatPercent / 100)

      return {
        id: product.id,
        product_type: 'material',
        name: product.name,
        material_id: product.id,
        length_mm: product.length_mm,
        width_mm: product.width_mm,
        thickness_mm: product.thickness_mm,
        quantity_on_hand: materialStockMap.get(product.id) || 0,
        gross_price: unitPricePerSqm,
        net_price: basePrice * multiplier,
        currency_name: product.currencies?.name || 'HUF',
        vat_id: product.vat?.id || '',
        currency_id: product.currencies?.id || '',
        image_url: product.image_url || null,
        base_price: basePrice,
        multiplier,
        vat_percent: vatPercent,
        unit_price_per_sqm: unitPricePerSqm
      }
    })

    const linearMaterials = (linearMaterialsResult.data || []).map((product: any) => {
      const vatPercent = product.vat?.kulcs || 0
      const basePrice = Number(product.base_price || 0)
      const multiplier = Number(product.multiplier || 1.38)
      const unitPricePerM = basePrice * multiplier * (1 + vatPercent / 100)

      return {
        id: product.id,
        product_type: 'linear_material',
        name: product.name,
        linear_material_id: product.id,
        length: product.length,
        width: product.width,
        thickness: product.thickness,
        quantity_on_hand: 0,
        gross_price: unitPricePerM,
        net_price: basePrice * multiplier,
        currency_name: product.currencies?.name || 'HUF',
        vat_id: product.vat?.id || '',
        currency_id: product.currencies?.id || '',
        image_url: product.image_url || null,
        base_price: basePrice,
        multiplier,
        vat_percent: vatPercent,
        unit_price_per_m: unitPricePerM
      }
    })

    const score = (name: string, exact: boolean, starts: boolean) => {
      if (exact) return 100
      if (starts) return 80
      if (name.toLowerCase().includes(trimmedSearch.toLowerCase())) return 60
      return 20
    }

    const combined = [...accessories, ...materials, ...linearMaterials]
      .map((item: any) => {
        const lower = trimmedSearch.toLowerCase()
        const nameLower = String(item.name || '').toLowerCase()
        const skuLower = String(item.sku || '').toLowerCase()
        const isExact = nameLower === lower || skuLower === lower
        const isStarts = nameLower.startsWith(lower) || skuLower.startsWith(lower)
        return { ...item, _score: score(nameLower, isExact, isStarts) }
      })
      .sort((a: any, b: any) => b._score - a._score || String(a.name).localeCompare(String(b.name), 'hu'))
      .slice(0, resultLimit)
      .map(({ _score, ...rest }: any) => rest)

    return NextResponse.json(combined)
  } catch (error) {
    console.error('Error in POS products GET:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

