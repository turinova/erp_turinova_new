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
    
    // Search materials table by name only
    const { data: materials, error: materialsError } = await supabaseServer
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
      .limit(50)
    
    if (materialsError) {
      console.error('Materials search error:', materialsError)
      return NextResponse.json({ error: 'Failed to search materials' }, { status: 500 })
    }
    
    // Search linear_materials table by name only
    const { data: linearMaterials, error: linearMaterialsError } = await supabaseServer
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
      .ilike('name', `%${searchTerm}%`)
      .limit(50) // Reasonable limit for performance
    
    if (linearMaterialsError) {
      console.error('Linear materials search error:', linearMaterialsError)
      return NextResponse.json({ error: 'Failed to search linear materials' }, { status: 500 })
    }
    
    console.log(`Found ${materials?.length || 0} materials and ${linearMaterials?.length || 0} linear materials`)
    
    // Add cache control headers for dynamic search results
    const response = NextResponse.json({ 
      materials: materials || [], 
      linearMaterials: linearMaterials || [] 
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
