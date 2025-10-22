import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import * as XLSX from 'xlsx'

// Export all materials to Excel (.xlsx)
export async function GET(request: NextRequest) {
  try {
    // Get filter parameters from query string
    const { searchParams } = new URL(request.url)
    const brandFilter = searchParams.get('brand')
    const lengthFilter = searchParams.get('length')
    const widthFilter = searchParams.get('width')
    const thicknessFilter = searchParams.get('thickness')
    const activeFilter = searchParams.get('active') // 'active' or 'inactive'

    console.log('Exporting materials to Excel with filters:', {
      brand: brandFilter,
      length: lengthFilter,
      width: widthFilter,
      thickness: thicknessFilter,
      active: activeFilter
    })

    // Build query with filters
    let query = supabaseServer
      .from('materials')
      .select(`
        id,
        name,
        length_mm,
        width_mm,
        thickness_mm,
        grain_direction,
        on_stock,
        active,
        base_price,
        multiplier,
        image_url,
        brands:brand_id(name),
        currencies:currency_id(name),
        vat:vat_id(kulcs),
        partners:partners_id(name),
        units:units_id(name, shortform),
        material_settings(
          kerf_mm,
          trim_top_mm,
          trim_right_mm,
          trim_bottom_mm,
          trim_left_mm,
          rotatable,
          waste_multi,
          usage_limit
        ),
        machine_material_map(machine_code)
      `)
      .is('deleted_at', null)

    // Apply filters if provided
    if (lengthFilter) {
      query = query.eq('length_mm', Number(lengthFilter))
    }
    if (widthFilter) {
      query = query.eq('width_mm', Number(widthFilter))
    }
    if (thicknessFilter) {
      query = query.eq('thickness_mm', Number(thicknessFilter))
    }
    if (activeFilter) {
      query = query.eq('active', activeFilter === 'active')
    }

    const { data: materials, error } = await query.order('name')

    // Filter by brand name (post-query since it's a joined field)
    let filteredMaterials = materials
    if (brandFilter && materials) {
      filteredMaterials = materials.filter(m => m.brands?.name === brandFilter)
    }

    if (error) {
      console.error('Error fetching materials for export:', error)
      return NextResponse.json({ error: 'Failed to fetch materials' }, { status: 500 })
    }

    console.log(`Fetched ${materials?.length || 0} materials from database`)
    console.log(`After filters: ${filteredMaterials?.length || 0} materials`)
    
    // Debug: Check active field values
    if (filteredMaterials && filteredMaterials.length > 0) {
      console.log('First material active status:', filteredMaterials[0].name, 'active:', filteredMaterials[0].active)
      console.log('Sample of active values:', filteredMaterials.slice(0, 3).map(m => ({ name: m.name, active: m.active })))
    }
    
    // Fetch all media files to map stored_filename -> original_filename
    const { data: mediaFiles } = await supabaseServer
      .from('media_files')
      .select('stored_filename, original_filename')
    
    const mediaMap = new Map(
      mediaFiles?.map(mf => [mf.stored_filename, mf.original_filename]) || []
    )
    
    console.log(`Loaded ${mediaMap.size} media files for filename mapping`)
    
    // Helper function to extract filename from image URL and get original name
    const getOriginalFilename = (imageUrl: string | null): string => {
      if (!imageUrl) return ''
      
      // Extract stored filename from URL
      // URL format: https://.../materials/materials/filename.webp
      const match = imageUrl.match(/materials\/materials\/(.+\.webp)/)
      if (!match) return ''
      
      const storedFilename = match[1]
      return mediaMap.get(storedFilename) || storedFilename  // Return original or fallback to stored
    }

    // Transform data for Excel export
    const excelData = filteredMaterials.map(m => ({
      'Gépkód': m.machine_material_map?.[0]?.machine_code || '',
      'Anyag neve': m.name,
      'Márka': m.brands?.name || '',
      'Kép fájlnév': getOriginalFilename(m.image_url),
      'Hossz (mm)': m.length_mm,
      'Szélesség (mm)': m.width_mm,
      'Vastagság (mm)': m.thickness_mm,
      'Beszerzési ár': m.base_price,
      'Árrés szorzó': m.multiplier,
      'Partner': m.partners?.name || '',
      'Mértékegység': m.units?.name || '',
      'Pénznem': m.currencies?.name || '',
      'ÁFA (%)': m.vat?.kulcs || '',
      'Raktáron': m.on_stock ? 'Igen' : 'Nem',
      'Aktív': m.active ? 'Igen' : 'Nem',
      'Szálirány': m.grain_direction ? 'Igen' : 'Nem',
      'Forgatható': m.material_settings?.[0]?.rotatable ? 'Igen' : 'Nem',
      'Fűrészlap vastagság (mm)': m.material_settings?.[0]?.kerf_mm || 3,
      'Szegélyezés felül (mm)': m.material_settings?.[0]?.trim_top_mm || 10,
      'Szegélyezés jobbra (mm)': m.material_settings?.[0]?.trim_right_mm || 10,
      'Szegélyezés alul (mm)': m.material_settings?.[0]?.trim_bottom_mm || 10,
      'Szegélyezés balra (mm)': m.material_settings?.[0]?.trim_left_mm || 10,
      'Hulladék szorzó': m.material_settings?.[0]?.waste_multi || 1.0,
      'Kihasználtság küszöb': m.material_settings?.[0]?.usage_limit || 0.65
    }))

    console.log(`Prepared ${excelData.length} materials for export`)

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(excelData)

    // Set column widths for better readability
    ws['!cols'] = [
      { wch: 20 }, // Gépkód
      { wch: 35 }, // Anyag neve
      { wch: 15 }, // Márka
      { wch: 20 }, // Kép fájlnév
      { wch: 12 }, // Hossz
      { wch: 12 }, // Szélesség
      { wch: 12 }, // Vastagság
      { wch: 12 }, // Ár/m²
      { wch: 10 }, // Pénznem
      { wch: 10 }, // ÁFA
      { wch: 10 }, // Raktáron
      { wch: 10 }, // Aktív
      { wch: 10 }, // Szálirány
      { wch: 12 }, // Forgatható
      { wch: 18 }, // Fűrészlap vastagság
      { wch: 18 }, // Szegélyezés felül
      { wch: 18 }, // Szegélyezés jobbra
      { wch: 18 }, // Szegélyezés alul
      { wch: 18 }, // Szegélyezés balra
      { wch: 15 }, // Hulladék szorzó
      { wch: 20 }  // Kihasználtság küszöb
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Anyagok')

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Return as downloadable file
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `anyagok_export_${timestamp}.xlsx`

    console.log(`Export complete: ${filename}`)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error in materials export:', error)
    return NextResponse.json({ 
      error: 'Export failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

