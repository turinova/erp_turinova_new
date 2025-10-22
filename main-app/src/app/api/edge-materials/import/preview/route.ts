import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Read the file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Parse the Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet)

    console.log(`Parsing ${data.length} rows from Excel`)

    // Fetch existing edge materials by machine code
    const { data: existingMachineCodes } = await supabaseServer
      .from('machine_edge_material_map')
      .select('machine_code, edge_material_id')
      .eq('machine_type', 'Korpus')

    const machineCodeMap = new Map(
      existingMachineCodes?.map(mc => [mc.machine_code, mc.edge_material_id]) || []
    )

    // Fetch all brands and VAT rates for validation
    const { data: brands } = await supabaseServer
      .from('brands')
      .select('id, name')
      .is('deleted_at', null)

    const { data: vatRates } = await supabaseServer
      .from('vat')
      .select('id, name, kulcs')

    const brandMap = new Map(brands?.map(b => [b.name, b.id]) || [])
    const preview = []
    const errors = []

    for (let i = 0; i < data.length; i++) {
      const row: any = data[i]
      const rowNum = i + 2 // Excel row number (1-indexed + header)

      // Validate required fields
      const requiredFields = {
        'Gépkód': row['Gépkód'],
        'Márka': row['Márka'],
        'Típus': row['Típus'],
        'Dekor': row['Dekor'],
        'Szélesség (mm)': row['Szélesség (mm)'],
        'Vastagság (mm)': row['Vastagság (mm)'],
        'Bruttó ár (Ft)': row['Bruttó ár (Ft)'] || row['Ár (Ft)'], // Support both old and new column names
        'Adónem': row['Adónem'],
        'Aktív': row['Aktív']
      }

      const missingFields = Object.entries(requiredFields)
        .filter(([_, value]) => value === undefined || value === null || value === '')
        .map(([field, _]) => field)

      if (missingFields.length > 0) {
        errors.push(`Sor ${rowNum}: Hiányzó mezők: ${missingFields.join(', ')}`)
        continue
      }

      // Validate Aktív field
      if (row['Aktív'] !== 'Igen' && row['Aktív'] !== 'Nem') {
        errors.push(`Sor ${rowNum}: Aktív mező értéke csak 'Igen' vagy 'Nem' lehet`)
        continue
      }

      // Check if machine code exists (to determine update vs create)
      const machineCode = row['Gépkód']?.toString().trim()
      const existingEdgeMaterialId = machineCodeMap.get(machineCode)
      const action = existingEdgeMaterialId ? 'Frissítés' : 'Új'

      // Parse VAT name and percentage
      const vatString = row['Adónem']?.toString() || ''
      const vatMatch = vatString.match(/(.+?)\s*\((\d+)%\)/)
      const vatName = vatMatch ? vatMatch[1].trim() : vatString.trim()
      const vatPercentage = vatMatch ? parseInt(vatMatch[2]) : null

      // Parse favourite_priority
      const favouritePriorityValue = row['Kedvenc sorrend']
      const favouritePriority = favouritePriorityValue && favouritePriorityValue !== '' 
        ? parseInt(favouritePriorityValue.toString()) 
        : null

      // Get gross price (support both old and new column names)
      const grossPrice = row['Bruttó ár (Ft)'] || row['Ár (Ft)'] || 0
      
      preview.push({
        row: rowNum,
        action,
        machineCode,
        brand: row['Márka'],
        type: row['Típus'],
        decor: row['Dekor'],
        width: row['Szélesség (mm)'],
        thickness: row['Vastagság (mm)'],
        price: grossPrice,
        vat: vatName,
        ráhagyás: row['Ráhagyás (mm)'] || 0,
        favouritePriority: favouritePriority,
        active: row['Aktív'] === 'Igen'
      })
    }

    // If there are validation errors, reject the entire import
    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        errors,
        preview: []
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      preview,
      errors: []
    })

  } catch (error) {
    console.error('Error previewing import:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Import preview failed',
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }, { status: 500 })
  }
}

