import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Try to fetch from the new materials_with_settings view first
    const { data: materialsWithSettings, error: viewError } = await supabase
      .from('materials_with_settings')
      .select('*')
      .order('brand_name, material_name')

    if (!viewError && materialsWithSettings) {
      // Transform the data to match the expected format
      const transformedData = materialsWithSettings.map(material => ({
        id: material.id,
        name: `${material.brand_name} - ${material.material_name}`,
        length_mm: material.length_mm,
        width_mm: material.width_mm,
        thickness_mm: material.thickness_mm,
        grain_direction: material.grain_direction,
        image_url: material.image_url,
        // Include optimization settings
        kerf_mm: material.kerf_mm,
        trim_top_mm: material.trim_top_mm,
        trim_right_mm: material.trim_right_mm,
        trim_bottom_mm: material.trim_bottom_mm,
        trim_left_mm: material.trim_left_mm,
        rotatable: material.rotatable,
        waste_multi: material.waste_multi,
        brand_name: material.brand_name,
        machine_code: material.machine_code,
        created_at: material.created_at,
        updated_at: material.updated_at
      }))

      return Response.json({ success: true, data: transformedData })
    }

    // Fallback to old materials table if the view doesn't exist yet
    const { data, error } = await supabase
      .from('materials')
      .select('*')

    if (error) throw error

    return Response.json({ success: true, data })
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
