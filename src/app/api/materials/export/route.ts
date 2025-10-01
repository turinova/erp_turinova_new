import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import * as XLSX from 'xlsx'

// Export all materials to Excel (.xlsx)
export async function GET(request: NextRequest) {
  try {
    console.log('Exporting materials to Excel...')

    // Fetch all materials with related data
    const { data: materials, error } = await supabaseServer
      .from('materials')
      .select(`
        id,
        name,
        length_mm,
        width_mm,
        thickness_mm,
        grain_direction,
        on_stock,
        price_per_sqm,
        brands:brand_id(name),
        currencies:currency_id(name),
        vat:vat_id(kulcs),
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
      .order('name')

    if (error) {
      console.error('Error fetching materials for export:', error)
      return NextResponse.json({ error: 'Failed to fetch materials' }, { status: 500 })
    }

    console.log(`Fetched ${materials?.length || 0} materials from database`)
    
    // Log first material for debugging
    if (materials && materials.length > 0) {
      console.log('Sample material data:', JSON.stringify(materials[0], null, 2))
    }

    // Transform data for Excel export
    const excelData = materials.map(m => ({
      'Gépkód': m.machine_material_map?.[0]?.machine_code || '',
      'Anyag neve': m.name,
      'Márka': m.brands?.name || '',
      'Hossz (mm)': m.length_mm,
      'Szélesség (mm)': m.width_mm,
      'Vastagság (mm)': m.thickness_mm,
      'Ár/m² (Ft)': m.price_per_sqm,
      'Pénznem': m.currencies?.name || '',
      'ÁFA (%)': m.vat?.kulcs || '',
      'Raktáron': m.on_stock ? 'Igen' : 'Nem',
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
      { wch: 12 }, // Hossz
      { wch: 12 }, // Szélesség
      { wch: 12 }, // Vastagság
      { wch: 12 }, // Ár/m²
      { wch: 10 }, // Pénznem
      { wch: 10 }, // ÁFA
      { wch: 10 }, // Raktáron
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

