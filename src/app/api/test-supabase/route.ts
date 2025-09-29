import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Check if Supabase is configured
const isSupabaseConfigured = supabaseUrl && supabaseKey

if (!isSupabaseConfigured) {
  console.warn('Supabase not configured for test-supabase API')
}

const supabase = isSupabaseConfigured ? createClient(supabaseUrl!, supabaseKey!) : null

export async function GET() {
  try {
    if (!supabase) {
      return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('Fetching materials for opti page (fixed version)...')
    
    const startTime = performance.now()
    
    // Use the materials_with_settings view but with better performance
    const { data: materials, error } = await supabase
      .from('materials_with_settings')
      .select('*')
      .limit(50) // Limit results to prevent memory issues
      .order('material_name', { ascending: true })
    
    const endTime = performance.now()
    const queryTime = endTime - startTime
    
    if (error) {
      console.error('Error fetching materials:', error)
      throw error
    }
    
    // Transform the data to match the expected format
    const transformedData = (materials || []).map(material => ({
      id: material.id,
      name: material.material_name || `Material ${material.id}`,
      length_mm: material.length_mm || 2800,
      width_mm: material.width_mm || 2070,
      thickness_mm: material.thickness_mm || 18,
      grain_direction: Boolean(material.grain_direction),
      on_stock: Boolean(material.on_stock),
      image_url: material.image_url || null,
      kerf_mm: material.kerf_mm || 3,
      trim_top_mm: material.trim_top_mm || 10,
      trim_right_mm: material.trim_right_mm || 0,
      trim_bottom_mm: material.trim_bottom_mm || 0,
      trim_left_mm: material.trim_left_mm || 10,
      rotatable: material.rotatable !== false,
      waste_multi: material.waste_multi || 1.0,
      brand_name: material.brand_name || 'Unknown',
      machine_code: 'MDF', // Default machine code
      created_at: material.created_at,
      updated_at: material.updated_at
    }))
    
    console.log(`Materials query took: ${queryTime.toFixed(2)}ms`)
    console.log(`Fetched ${transformedData.length} materials successfully`)
    
    return Response.json({ 
      success: true, 
      data: transformedData,
      queryTime: queryTime.toFixed(2) + 'ms'
    })
    
  } catch (error) {
    console.error('Error in test-supabase-fixed:', error)
    
return Response.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}