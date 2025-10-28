import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  try {
    const { data: linearMaterials, error } = await supabaseServer
      .from('linear_materials')
      .select(`
        *,
        brands (name),
        currencies (name),
        vat (name, kulcs),
        partners (name),
        units (name, shortform)
      `)
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch linear materials', details: error.message }, { status: 500 })
    }

    // Fetch machine codes
    const linearMaterialIds = linearMaterials?.map(lm => lm.id) || []
    const { data: machineCodes } = await supabaseServer
      .from('machine_linear_material_map')
      .select('linear_material_id, machine_code')
      .in('linear_material_id', linearMaterialIds)
      .eq('machine_type', 'Korpus')

    const machineCodeMap = new Map(
      machineCodes?.map(mc => [mc.linear_material_id, mc.machine_code]) || []
    )

    // Fetch media filenames for image URLs
    console.log('=== LINEAR MATERIALS EXPORT DEBUG: Fetching media files ===')
    const { data: mediaFiles, error: mediaError } = await supabaseServer
      .from('media_files')
      .select('full_url, original_filename')

    if (mediaError) {
      console.error('Error fetching media files:', mediaError)
    }

    // Create map: full_url -> original_filename
    const mediaUrlMap = new Map(
      mediaFiles?.map(mf => [mf.full_url, mf.original_filename]) || []
    )

    console.log(`Loaded ${mediaUrlMap.size} media files for URL -> filename mapping`)

    // Function to get original filename from image URL (same as materials)
    const getOriginalFilename = (imageUrl: string | null): string => {
      if (!imageUrl) return ''
      
      // First try: Direct lookup in media_files table by full_url
      const originalName = mediaUrlMap.get(imageUrl)
      if (originalName) {
        return originalName
      }
      
      // Fallback: Extract filename from URL for files not in media_files table
      // URL format: https://.../linear-materials/linear-materials/timestamp-filename.ext
      const match = imageUrl.match(/linear-materials\/linear-materials\/\d+-(.+\.(webp|png|jpeg|jpg|gif))$/)
      if (match) {
        return match[1] // Return the original filename part
      }
      
      // Last resort: extract any filename from the URL
      const urlParts = imageUrl.split('/')
      const filename = urlParts[urlParts.length - 1]
      return filename || ''
    }

    // Transform for Excel
    const excelData = linearMaterials?.map((lm: any) => {
      const imageFilename = getOriginalFilename(lm.image_url)
      
      return {
        'Gépkód': machineCodeMap.get(lm.id) || '',
        'Márka': lm.brands?.name || '',
        'Név': lm.name || '',
        'Típus': lm.type || '',
        'Szélesség (mm)': lm.width || 0,
        'Hossz (mm)': lm.length || 0,
        'Vastagság (mm)': lm.thickness || 0,
        'Beszerzési ár': lm.base_price || 0,
        'Árrés szorzó': lm.multiplier || 1.38,
        'Partner': lm.partners?.name || '',
        'Mértékegység': lm.units?.name || '',
        'Pénznem': lm.currencies?.name || '',
        'Adónem': lm.vat ? `${lm.vat.name} (${lm.vat.kulcs}%)` : '',
        'Kép': imageFilename,
        'Raktáron': lm.on_stock ? 'Igen' : 'Nem',
        'Aktív': lm.active ? 'Igen' : 'Nem',
      }
    }) || []

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(excelData)

    ws['!cols'] = [
      { wch: 15 }, // Gépkód
      { wch: 20 }, // Márka
      { wch: 30 }, // Név
      { wch: 20 }, // Típus
      { wch: 15 }, // Szélesség
      { wch: 15 }, // Hossz
      { wch: 15 }, // Vastagság
      { wch: 15 }, // Beszerzési ár
      { wch: 15 }, // Árrés szorzó
      { wch: 20 }, // Partner
      { wch: 15 }, // Mértékegység
      { wch: 10 }, // Pénznem
      { wch: 20 }, // Adónem
      { wch: 30 }, // Kép
      { wch: 10 }, // Raktáron
      { wch: 10 }  // Aktív
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Szálas anyagok')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="szalas_anyagok_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}

