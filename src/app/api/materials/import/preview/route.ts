import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import * as XLSX from 'xlsx'

// Preview materials import from Excel file
export async function POST(request: NextRequest) {
  try {
    console.log('Processing materials import preview...')

    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Read Excel file
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet)

    console.log(`Parsed ${jsonData.length} rows from Excel`)

    if (jsonData.length === 0) {
      return NextResponse.json({ error: 'Az Excel fájl üres!' }, { status: 400 })
    }

    // Fetch existing materials by gépkód for matching (exclude deleted materials)
    const { data: existingMaterials } = await supabaseServer
      .from('machine_material_map')
      .select('machine_code, material_id, materials!inner(id, name, deleted_at)')
      .is('materials.deleted_at', null)

    console.log(`Found ${existingMaterials?.length || 0} existing materials in machine_material_map`)

    const materialsByCode = new Map(
      existingMaterials?.map(m => [m.machine_code?.trim(), m]) || []
    )

    // Fetch all brands, currencies/VAT, and media files for validation
    const [brandsRes, currenciesRes, vatRes, mediaFilesRes] = await Promise.all([
      supabaseServer.from('brands').select('id, name'),
      supabaseServer.from('currencies').select('id, name'),
      supabaseServer.from('vat').select('id, kulcs'),
      supabaseServer.from('media_files').select('original_filename, stored_filename, full_url')
    ])

    const brandsByName = new Map(brandsRes.data?.map(b => [b.name.toLowerCase(), b]) || [])
    const currenciesByName = new Map(currenciesRes.data?.map(c => [c.name.toUpperCase(), c]) || [])
    const vatByPercent = new Map(vatRes.data?.map(v => [v.kulcs, v]) || [])
    const mediaFilesByOriginalName = new Map(mediaFilesRes.data?.map(mf => [mf.original_filename, mf]) || [])

    // Validate and transform data
    const validationErrors: string[] = []
    const preview: any[] = []
    const newBrands = new Set<string>()

    for (let i = 0; i < jsonData.length; i++) {
      const row: any = jsonData[i]
      const rowNum = i + 2 // Excel row (1-indexed + header)

      // Required fields validation
      const requiredFields = {
        'Gépkód': row['Gépkód'],
        'Anyag neve': row['Anyag neve'],
        'Márka': row['Márka'],
        'Hossz (mm)': row['Hossz (mm)'],
        'Szélesség (mm)': row['Szélesség (mm)'],
        'Vastagság (mm)': row['Vastagság (mm)'],
        'Pénznem': row['Pénznem'],
        'ÁFA (%)': row['ÁFA (%)'],
        'Aktív': row['Aktív']
      }

      for (const [fieldName, value] of Object.entries(requiredFields)) {
        if (value === undefined || value === null || value === '') {
          validationErrors.push(`Sor ${rowNum}: "${fieldName}" mező kötelező!`)
        }
      }
      
      // Validate Aktív field (must be "Igen" or "Nem")
      const activeValue = String(row['Aktív'] || '').trim().toLowerCase()
      if (activeValue && activeValue !== 'igen' && activeValue !== 'nem') {
        validationErrors.push(`Sor ${rowNum}: "Aktív" mező csak "Igen" vagy "Nem" lehet`)
      }

      // Check if currency exists
      const currencyName = String(row['Pénznem'] || '').toUpperCase()
      if (currencyName && !currenciesByName.has(currencyName)) {
        validationErrors.push(`Sor ${rowNum}: Ismeretlen pénznem "${row['Pénznem']}"`)
      }

      // Check if VAT rate exists
      const vatPercent = Number(row['ÁFA (%)'])
      if (!isNaN(vatPercent) && !vatByPercent.has(vatPercent)) {
        validationErrors.push(`Sor ${rowNum}: Ismeretlen ÁFA kulcs "${row['ÁFA (%)']}"`)
      }

      // Check if brand exists or needs to be created
      const brandName = String(row['Márka'] || '').trim()
      if (brandName && !brandsByName.has(brandName.toLowerCase())) {
        newBrands.add(brandName)
      }
      
      // Check if image filename exists (optional field)
      const imageFilename = String(row['Kép fájlnév'] || '').trim()
      if (imageFilename && !mediaFilesByOriginalName.has(imageFilename)) {
        validationErrors.push(`Sor ${rowNum}: Kép fájl "${imageFilename}" nem található a Media könyvtárban!`)
      }

      // Determine if update or create
      const machineCode = String(row['Gépkód'] || '').trim()
      const existingMaterial = materialsByCode.get(machineCode)
      const action = existingMaterial ? 'UPDATE' : 'CREATE'
      
      if (!existingMaterial) {
        console.log(`Material with gépkód "${machineCode}" not found, will CREATE`)
      }

      // Calculate price from base_price and multiplier
      const basePrice = parseFloat(row['Beszerzési ár']) || 0
      const multiplier = parseFloat(row['Árrés szorzó']) || 1.38
      const calculatedPrice = Math.round(basePrice * multiplier)

      preview.push({
        rowNum,
        action,
        machineCode,
        name: row['Anyag neve'],
        brand: row['Márka'],
        dimensions: `${row['Hossz (mm)']}×${row['Szélesség (mm)']}×${row['Vastagság (mm)']}`,
        price: calculatedPrice,
        currency: row['Pénznem'],
        vat: row['ÁFA (%)'],
        existingId: existingMaterial?.material_id,
        existingName: existingMaterial?.materials?.name
      })
    }

    // If there are ANY validation errors, reject the entire import
    if (validationErrors.length > 0) {
      console.error('Import validation failed:', validationErrors)
      return NextResponse.json({ 
        error: 'Validációs hibák:',
        details: validationErrors
      }, { status: 400 })
    }

    console.log(`Preview ready: ${preview.filter(p => p.action === 'CREATE').length} új, ${preview.filter(p => p.action === 'UPDATE').length} frissítés`)
    if (newBrands.size > 0) {
      console.log(`New brands to create: ${Array.from(newBrands).join(', ')}`)
    }

    return NextResponse.json({
      preview,
      newBrands: Array.from(newBrands),
      stats: {
        total: preview.length,
        create: preview.filter(p => p.action === 'CREATE').length,
        update: preview.filter(p => p.action === 'UPDATE').length
      }
    })
  } catch (error) {
    console.error('Error in materials import preview:', error)
    return NextResponse.json({ 
      error: 'Import preview failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

