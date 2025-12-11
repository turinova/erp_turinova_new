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
          material_accessories!left (
            accessory_id,
            accessories (
              id,
              name,
              sku,
              base_price,
              partners (
                id,
                name
              )
            )
          ),
          brands (name),
          vat (kulcs)
        `)
        .is('deleted_at', null)
        .ilike('name', `%${searchTerm}%`)
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
          linear_material_accessories!left (
            accessory_id,
            accessories (
              id,
              name,
              sku,
              base_price,
              partners (
                id,
                name
              )
            )
          ),
          brands (name),
          vat (kulcs)
        `)
        .is('deleted_at', null)
        .ilike('name', `%${searchTerm}%`)
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
    
    // Normalize accessories structure
    const normalizedMaterials = (materials || []).map((m: any) => ({
      ...m,
      accessories: (m.material_accessories || []).map((ma: any) => ({
        id: ma.accessories?.id,
        name: ma.accessories?.name,
        sku: ma.accessories?.sku,
        partner_name: ma.accessories?.partners?.name || '',
        base_price: ma.accessories?.base_price
      }))
    }))

    const normalizedLinearMaterials = (linearMaterials || []).map((lm: any) => ({
      ...lm,
      accessories: (lm.linear_material_accessories || []).map((lma: any) => ({
        id: lma.accessories?.id,
        name: lma.accessories?.name,
        sku: lma.accessories?.sku,
        partner_name: lma.accessories?.partners?.name || '',
        base_price: lma.accessories?.base_price
      }))
    }))

    // Add cache control headers for dynamic search results
    const response = NextResponse.json({
      materials: normalizedMaterials, 
      linearMaterials: normalizedLinearMaterials 
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
