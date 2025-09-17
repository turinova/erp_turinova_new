import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { redisCache } from '@/lib/redis'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const CACHE_TTL = 300 // 5 minutes in seconds

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: materialId } = await params
    const cacheKey = `material:${materialId}`
    console.log(`Fetching material ${materialId} with Redis caching...`)

    // Try to get from Redis cache first
    const cachedMaterial = await redisCache.get<any>(cacheKey)
    if (cachedMaterial) {
      console.log(`Material ${materialId} served from Redis cache`)
      return Response.json(cachedMaterial, {
        headers: {
          'X-Cache': 'HIT',
          'X-Cache-Source': 'Redis',
        },
      })
    }

    console.log(`Redis cache miss for material ${materialId}, fetching from database...`)
    const startTime = performance.now()
    
    // Fetch material from materials_with_settings view
    const { data, error } = await supabase
      .from('materials_with_settings')
      .select('*')
      .eq('id', materialId)
      .single()

    if (error) {
      console.error('Error fetching material:', error)
      return Response.json({ 
        success: false, 
        error: error.message 
      }, { status: 404 })
    }

    if (!data) {
      return Response.json({ 
        success: false, 
        error: 'Material not found' 
      }, { status: 404 })
    }

    // Fetch brand_id from materials table
    const { data: materialData } = await supabase
      .from('materials')
      .select('brand_id')
      .eq('id', materialId)
      .single()

    // Fetch machine code from machine_material_map
    const { data: machineData } = await supabase
      .from('machine_material_map')
      .select('machine_code')
      .eq('material_id', materialId)
      .eq('machine_type', 'Korpus')
      .single()

    const endTime = performance.now()
    const queryTime = endTime - startTime
    console.log(`Material ${materialId} database query took: ${queryTime.toFixed(2)}ms`)

    // Transform the data to match the expected format
    const transformedData = {
      id: data.id,
      name: data.material_name || `Material ${data.id}`,
      length_mm: data.length_mm || 2800,
      width_mm: data.width_mm || 2070,
      thickness_mm: data.thickness_mm || 18,
      grain_direction: Boolean(data.grain_direction),
      on_stock: data.on_stock !== undefined ? Boolean(data.on_stock) : true,
      image_url: data.image_url || null,
      brand_id: materialData?.brand_id || '',
      brand_name: data.brand_name || 'Unknown',
      kerf_mm: data.kerf_mm || 3,
      trim_top_mm: data.trim_top_mm || 0,
      trim_right_mm: data.trim_right_mm || 0,
      trim_bottom_mm: data.trim_bottom_mm || 0,
      trim_left_mm: data.trim_left_mm || 0,
      rotatable: data.rotatable !== false,
      waste_multi: data.waste_multi || 1.0,
      machine_code: machineData?.machine_code || '',
      created_at: data.created_at,
      updated_at: data.updated_at
    }

    console.log(`Fetched material successfully: ${transformedData.name}`)

    // Cache the result in Redis
    await redisCache.set(cacheKey, transformedData, CACHE_TTL)

    return Response.json(transformedData, {
      headers: {
        'X-Cache': 'MISS',
        'X-Cache-Source': 'Database',
        'X-Cache-Time': `${queryTime.toFixed(2)}ms`,
      },
    })
  } catch (error) {
    console.error('Error in GET /api/materials/[id]:', error)
    return Response.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: materialId } = await params
    const body = await request.json()
    
    console.log(`Updating material ${materialId}, invalidating Redis cache...`)
    console.log('Update data:', body)
    
    // Update the materials table
    const { data: materialData, error: materialError } = await supabase
      .from('materials')
      .update({
        name: body.name,
        length_mm: body.length_mm,
        width_mm: body.width_mm,
        thickness_mm: body.thickness_mm,
        grain_direction: body.grain_direction,
        on_stock: body.on_stock,
        image_url: body.image_url || null,
        brand_id: body.brand_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', materialId)
      .select()
      .single()

    if (materialError) {
      console.error('Error updating materials table:', materialError)
      return Response.json({ 
        success: false, 
        error: materialError.message 
      }, { status: 500 })
    }

    // Update the material_settings table using upsert with proper conflict resolution
    const { data: settingsData, error: settingsError } = await supabase
      .from('material_settings')
      .upsert({
        material_id: materialId,
        kerf_mm: body.kerf_mm,
        trim_top_mm: body.trim_top_mm,
        trim_right_mm: body.trim_right_mm,
        trim_bottom_mm: body.trim_bottom_mm,
        trim_left_mm: body.trim_left_mm,
        rotatable: body.rotatable,
        waste_multi: body.waste_multi,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'material_id'
      })
      .select()
      .single()

    if (settingsError) {
      console.error('Error updating material_settings table:', settingsError)
      return Response.json({ 
        success: false, 
        error: settingsError.message 
      }, { status: 500 })
    }

    // Update the machine_material_map table
    if (body.machine_code) {
      const { data: machineData, error: machineError } = await supabase
        .from('machine_material_map')
        .upsert({
          material_id: materialId,
          machine_type: 'Korpus',
          machine_code: body.machine_code,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'material_id,machine_type'
        })
        .select()
        .single()

      if (machineError) {
        console.error('Error updating machine_material_map table:', machineError)
        return Response.json({ 
          success: false, 
          error: machineError.message 
        }, { status: 500 })
      }
    }

    // Invalidate cache for this specific material and all materials list
    await redisCache.del(`material:${materialId}`)
    await redisCache.delPattern('materials:*')

    console.log(`Material updated successfully and cache invalidated: ${body.name}`)
    return Response.json({ 
      success: true, 
      message: 'Material updated successfully',
      data: { material: materialData, settings: settingsData }
    })
  } catch (error) {
    console.error('Error in PUT /api/materials/[id]:', error)
    return Response.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
