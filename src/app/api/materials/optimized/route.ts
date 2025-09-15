import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET() {
  try {
    console.log('Fetching materials (optimized)...')
    
    const startTime = performance.now()
    
    // Single optimized query with all columns - FAST!
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .limit(50) // Limit results to prevent memory issues
      .order('id', { ascending: true })

    const endTime = performance.now()
    const queryTime = endTime - startTime
    
    console.log(`Materials query took: ${queryTime.toFixed(2)}ms`)

    if (error) {
      console.error('Error fetching materials:', error)
      throw error
    }

    // Transform the data to match the expected format
    const transformedData = (data || []).map(material => ({
      id: material.id,
      name: material.name || `Material ${material.id}`,
      length_mm: material.length_mm || 2800,
      width_mm: material.width_mm || 2070,
      thickness_mm: material.thickness_mm || 18,
      grain_direction: material.grain_direction || 'length',
      image_url: material.image_url || null,
      // Include optimization settings with defaults
      kerf_mm: material.kerf_mm || 3,
      trim_top_mm: material.trim_top_mm || 10,
      trim_right_mm: material.trim_right_mm || 0,
      trim_bottom_mm: material.trim_bottom_mm || 0,
      trim_left_mm: material.trim_left_mm || 10,
      rotatable: material.rotatable !== false,
      waste_multi: material.waste_multi || 1.0,
      brand_name: material.brand_name || 'Unknown',
      machine_code: material.machine_code || 'MDF',
      created_at: material.created_at,
      updated_at: material.updated_at
    }))

    console.log(`Fetched ${transformedData.length} materials successfully`)
    return Response.json({ success: true, data: transformedData })
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
