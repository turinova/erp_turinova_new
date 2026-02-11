import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    
    if (!query || query.trim().length === 0) {
      return NextResponse.json({ materials: [], linearMaterials: [] })
    }
    
    const searchTerm = query.trim()
    console.log('Searching for:', searchTerm)
    
    // Search materials and linear_materials in parallel for better performance
    // Removed accessories from main query - will be fetched on-demand when user clicks
    const [materialsResult, linearMaterialsResult] = await Promise.all([
      // Search materials table by name
      supabaseServer
        .from('materials')
        .select(`
          id,
          name,
          brand_id,
          length_mm,
          width_mm,
          thickness_mm,
          price_per_sqm,
          vat_id,
          brands (name),
          vat (kulcs)
        `)
        .is('deleted_at', null)
        .ilike('name', `%${searchTerm}%`)
        .order('name', { ascending: true })
        .limit(50),
      // Search linear_materials table by name
      supabaseServer
        .from('linear_materials')
        .select(`
          id,
          name,
          brand_id,
          length,
          width,
          thickness,
          price_per_m,
          vat_id,
          type,
          brands (name),
          vat (kulcs)
        `)
        .is('deleted_at', null)
        .ilike('name', `${searchTerm}%`)
        .order('name', { ascending: true })
        .limit(50)
    ])
    
    const { data: materials, error: materialsError } = materialsResult
    const { data: linearMaterials, error: linearMaterialsError } = linearMaterialsResult
    
    if (materialsError) {
      console.error('Materials search error:', materialsError)
      return NextResponse.json({ error: 'Failed to search materials' }, { status: 500 })
    }
    
    if (linearMaterialsError) {
      console.error('Linear materials search error:', linearMaterialsError)
      return NextResponse.json({ error: 'Failed to search linear materials' }, { status: 500 })
    }
    
    console.log(`Found ${materials?.length || 0} materials and ${linearMaterials?.length || 0} linear materials`)
    
    // Fetch stock data for materials and linear_materials in parallel
    const materialIds = (materials || []).map(m => m.id)
    const linearMaterialIds = (linearMaterials || []).map(lm => lm.id)
    
    const [materialsStockResult, linearMaterialsStockResult] = await Promise.all([
      // Fetch stock for materials
      materialIds.length > 0
        ? supabaseServer
            .from('current_stock')
            .select('material_id, quantity_on_hand')
            .eq('product_type', 'material')
            .in('material_id', materialIds)
        : Promise.resolve({ data: [], error: null }),
      // Fetch stock for linear_materials
      linearMaterialIds.length > 0
        ? supabaseServer
            .from('current_stock')
            .select('linear_material_id, quantity_on_hand')
            .eq('product_type', 'linear_material')
            .in('linear_material_id', linearMaterialIds)
        : Promise.resolve({ data: [], error: null })
    ])
    
    // Aggregate stock quantities by material/linear_material ID (sum across all warehouses)
    const materialsStockMap = new Map<string, number>()
    if (materialsStockResult.data) {
      materialsStockResult.data.forEach((stock: any) => {
        if (stock.material_id) {
          const current = materialsStockMap.get(stock.material_id) || 0
          materialsStockMap.set(stock.material_id, current + Number(stock.quantity_on_hand || 0))
        }
      })
    }
    
    const linearMaterialsStockMap = new Map<string, number>()
    if (linearMaterialsStockResult.data) {
      linearMaterialsStockResult.data.forEach((stock: any) => {
        if (stock.linear_material_id) {
          const current = linearMaterialsStockMap.get(stock.linear_material_id) || 0
          linearMaterialsStockMap.set(stock.linear_material_id, current + Number(stock.quantity_on_hand || 0))
        }
      })
    }
    
    // Add stock data to materials and linear_materials
    const materialsWithStock = (materials || []).map(material => ({
      ...material,
      quantity_on_hand: materialsStockMap.get(material.id) || null
    }))
    
    const linearMaterialsWithStock = (linearMaterials || []).map(linearMaterial => ({
      ...linearMaterial,
      quantity_on_hand: linearMaterialsStockMap.get(linearMaterial.id) || null
    }))
    
    // Accessories removed from main query - will be fetched on-demand via separate API endpoints
    // This significantly improves search performance by avoiding deep nested joins
    
    // Add cache control headers for dynamic search results
    const response = NextResponse.json({
      materials: materialsWithStock, 
      linearMaterials: linearMaterialsWithStock 
    })
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    return response
    
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
