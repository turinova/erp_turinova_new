import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { invalidateApiCache } from '@/hooks/useApiCache'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// GET /api/materials - List materials with optional search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('q')
    
    console.log('Fetching materials...')
    const startTime = performance.now()
    
    let query = supabase
      .from('materials_with_settings')
      .select('*')
      .limit(50) // Limit results to prevent memory issues
      .order('id', { ascending: true })
    
    // Add search filter if provided
    if (search) {
      query = query.or(`material_name.ilike.%${search}%,brand_name.ilike.%${search}%`)
    }
    
    const { data, error } = await query
    
    const endTime = performance.now()
    const queryTime = endTime - startTime
    
    console.log(`Materials query took: ${queryTime.toFixed(2)}ms`)

    if (error) {
      console.error('Error fetching materials:', error)
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to fetch materials',
        error: error.message 
      }, { status: 500 })
    }

    // Transform the data to match the expected format
    const transformedMaterials = data?.map(material => ({
      id: material.id,
      name: `${material.brand_name} ${material.material_name}`,
      brand_name: material.brand_name,
      material_name: material.material_name,
      length_mm: material.length_mm,
      width_mm: material.width_mm,
      thickness_mm: material.thickness_mm,
      grain_direction: material.grain_direction,
      on_stock: material.on_stock,
      image_url: material.image_url,
      kerf_mm: material.kerf_mm,
      trim_top_mm: material.trim_top_mm,
      trim_right_mm: material.trim_right_mm,
      trim_bottom_mm: material.trim_bottom_mm,
      trim_left_mm: material.trim_left_mm,
      rotatable: material.rotatable,
      waste_multi: material.waste_multi,
      created_at: material.created_at,
      updated_at: material.updated_at
    })) || []

    console.log(`Fetched ${transformedMaterials.length} materials successfully`)
    
    return NextResponse.json(transformedMaterials)
  } catch (error) {
    console.error('Error in materials API:', error)
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST /api/materials - Create new material
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    if (!body.brand_name || !body.material_name) {
      return NextResponse.json({
        success: false,
        message: 'Brand name and material name are required'
      }, { status: 400 })
    }

    console.log('Creating new material:', body.brand_name, body.material_name)
    
    const { data, error } = await supabase
      .from('materials')
      .insert([{
        brand_name: body.brand_name,
        material_name: body.material_name,
        length_mm: body.length_mm || 2800,
        width_mm: body.width_mm || 2070,
        thickness_mm: body.thickness_mm || 18,
        grain_direction: body.grain_direction || false,
        on_stock: body.on_stock !== undefined ? body.on_stock : true,
        kerf_mm: body.kerf_mm || 3,
        trim_top_mm: body.trim_top_mm || 40,
        trim_right_mm: body.trim_right_mm || 40,
        trim_bottom_mm: body.trim_bottom_mm || 40,
        trim_left_mm: body.trim_left_mm || 40,
        rotatable: body.rotatable || false,
        waste_multi: body.waste_multi || 3
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating material:', error)
      return NextResponse.json({
        success: false,
        message: 'Failed to create material',
        error: error.message
      }, { status: 500 })
    }

    console.log('Material created successfully:', data.id)
    
    // Invalidate cache
    invalidateApiCache('/api/materials')
    
    return NextResponse.json({
      success: true,
      message: 'Material created successfully',
      data: {
        id: data.id,
        name: `${data.brand_name} ${data.material_name}`,
        brand_name: data.brand_name,
        material_name: data.material_name,
        length_mm: data.length_mm,
        width_mm: data.width_mm,
        thickness_mm: data.thickness_mm,
        grain_direction: data.grain_direction,
        on_stock: data.on_stock,
        image_url: data.image_url,
        kerf_mm: data.kerf_mm,
        trim_top_mm: data.trim_top_mm,
        trim_right_mm: data.trim_right_mm,
        trim_bottom_mm: data.trim_bottom_mm,
        trim_left_mm: data.trim_left_mm,
        rotatable: data.rotatable,
        waste_multi: data.waste_multi,
        created_at: data.created_at,
        updated_at: data.updated_at
      }
    })
  } catch (error) {
    console.error('Error in materials POST API:', error)
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}