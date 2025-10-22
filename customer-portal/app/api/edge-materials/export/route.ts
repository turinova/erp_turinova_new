import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  console.log('=== Export edge materials started ===')
  console.log('XLSX library loaded:', typeof XLSX !== 'undefined')
  
  try {
    console.log('Using supabaseServer')

    // Fetch all edge materials with related data
    const { data: edgeMaterials, error } = await supabaseServer
      .from('edge_materials')
      .select(`
        *,
        brands (name),
        vat (name, kulcs)
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching edge materials:', error)
      return NextResponse.json({ error: 'Failed to fetch edge materials', details: error.message }, { status: 500 })
    }

    console.log(`Fetched ${edgeMaterials?.length || 0} edge materials`)
    if (edgeMaterials && edgeMaterials.length > 0) {
      console.log('Sample edge material:', JSON.stringify(edgeMaterials[0], null, 2))
    }

    // Fetch machine codes for all edge materials
    const edgeMaterialIds = edgeMaterials?.map(em => em.id) || []
    const { data: machineCodes } = await supabaseServer
      .from('machine_edge_material_map')
      .select('edge_material_id, machine_code')
      .in('edge_material_id', edgeMaterialIds)
      .eq('machine_type', 'Korpus')

    // Create a map of edge material ID to machine code
    const machineCodeMap = new Map(
      machineCodes?.map(mc => [mc.edge_material_id, mc.machine_code]) || []
    )

    // Transform data for Excel
    const excelData = edgeMaterials?.map((em: any) => {
      const brandName = em.brands?.name || ''
      const vatInfo = em.vat ? `${em.vat.name} (${em.vat.kulcs}%)` : ''
      
      // Calculate gross price from net price
      const vatRate = em.vat?.kulcs || 0
      const grossPrice = Math.round(em.price * (1 + vatRate / 100))
      
      return {
        'Gépkód': machineCodeMap.get(em.id) || '',
        'Márka': brandName,
        'Típus': em.type || '',
        'Dekor': em.decor || '',
        'Szélesség (mm)': em.width || 0,
        'Vastagság (mm)': em.thickness || 0,
        'Bruttó ár (Ft)': grossPrice,
        'Adónem': vatInfo,
        'Ráhagyás (mm)': em.ráhagyás || 0,
        'Kedvenc sorrend': em.favourite_priority || '',
        'Aktív': em.active ? 'Igen' : 'Nem',
      }
    }) || []

    console.log(`Exporting ${excelData.length} edge materials`)
    if (excelData.length > 0) {
      console.log('Sample export row:', JSON.stringify(excelData[0], null, 2))
    }

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(excelData)

    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // Gépkód
      { wch: 20 }, // Márka
      { wch: 15 }, // Típus
      { wch: 25 }, // Dekor
      { wch: 15 }, // Szélesség
      { wch: 15 }, // Vastagság
      { wch: 15 }, // Bruttó ár
      { wch: 20 }, // Adónem
      { wch: 15 }, // Ráhagyás
      { wch: 15 }, // Kedvenc sorrend
      { wch: 10 }, // Aktív
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Élzárók')

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    console.log('Export completed successfully')

    // Return the file
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="elzarok_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Error exporting edge materials:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      error: 'Export failed', 
      details: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

