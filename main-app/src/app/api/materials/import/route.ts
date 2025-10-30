import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import * as XLSX from 'xlsx'

// Import materials from Excel file (after preview confirmation)
export async function POST(request: NextRequest) {
  try {
    console.log('Processing materials import...')

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

    // Fetch lookup data
    const [brandsRes, currenciesRes, vatRes, partnersRes, unitsRes, existingMaterialsRes, mediaFilesRes] = await Promise.all([
      supabaseServer.from('brands').select('id, name'),
      supabaseServer.from('currencies').select('id, name'),
      supabaseServer.from('vat').select('id, kulcs'),
      supabaseServer.from('partners').select('id, name'),
      supabaseServer.from('units').select('id, name, shortform'),
      supabaseServer
        .from('machine_material_map')
        .select('machine_code, material_id, materials!inner(deleted_at)')
        .is('materials.deleted_at', null),
      supabaseServer.from('media_files').select('original_filename, stored_filename, full_url')
    ])

    console.log(`Import: Found ${existingMaterialsRes.data?.length || 0} existing materials`)

    const brandsByName = new Map(brandsRes.data?.map(b => [b.name.toLowerCase(), b]) || [])
    const currenciesByName = new Map(currenciesRes.data?.map(c => [c.name.toUpperCase(), c]) || [])
    const vatByPercent = new Map(vatRes.data?.map(v => [v.kulcs, v]) || [])
    const partnersByName = new Map(partnersRes.data?.map(p => [p.name.toLowerCase(), p]) || [])
    const unitsByName = new Map(unitsRes.data?.map(u => [u.name.toLowerCase(), u]) || [])
    const materialsByCode = new Map(existingMaterialsRes.data?.map(m => [m.machine_code?.trim(), m.material_id]) || [])
    // Create map: original_filename -> full_url
    const mediaFilesByOriginalName = new Map(mediaFilesRes.data?.map(mf => [mf.original_filename, mf.full_url]) || [])
    
    // Also get existing materials to find URLs that match the filename pattern
    const { data: existingMaterials } = await supabaseServer
      .from('materials')
      .select('image_url')
      .not('image_url', 'is', null)
    
    // Create a reverse lookup: extract filename from existing material URLs
    const materialUrlsByFilename = new Map()
    existingMaterials?.forEach(material => {
      if (material.image_url) {
        // Extract filename from URL pattern: timestamp-filename.ext
        const match = material.image_url.match(/materials\/materials\/\d+-(.+\.(webp|png|jpeg|jpg|gif))$/)
        if (match) {
          const filename = match[1]
          materialUrlsByFilename.set(filename, material.image_url)
        }
      }
    })
    
    console.log(`Import: Created media map - ${mediaFilesByOriginalName.size} files by original filename`)
    console.log(`Import: Created material URL map - ${materialUrlsByFilename.size} files from existing materials`)

    const results = {
      created: 0,
      updated: 0,
      brandsCreated: [] as string[],
      errors: [] as string[]
    }

    for (let i = 0; i < jsonData.length; i++) {
      const row: any = jsonData[i]
      const rowNum = i + 2

      try {
        const machineCode = String(row['Gépkód'] || '').trim()
        const brandName = String(row['Márka'] || '').trim()
        const currencyName = String(row['Pénznem'] || '').toUpperCase()
        const vatPercent = Number(row['ÁFA (%)'])
        const partnerName = String(row['Partner'] || '').trim()
        const unitName = String(row['Mértékegység'] || '').trim()

        // Get or create brand
        let brand = brandsByName.get(brandName.toLowerCase())
        if (!brand) {
          console.log(`Creating new brand: ${brandName}`)
          const { data: newBrand, error: brandError } = await supabaseServer
            .from('brands')
            .insert({ name: brandName })
            .select()
            .single()

          if (brandError) {
            throw new Error(`Failed to create brand: ${brandError.message}`)
          }

          brand = newBrand
          brandsByName.set(brandName.toLowerCase(), brand)
          results.brandsCreated.push(brandName)
        }

        // Get currency, VAT, partner, and unit IDs
        const currency = currenciesByName.get(currencyName)
        const vat = vatByPercent.get(vatPercent)
        const partner = partnerName ? partnersByName.get(partnerName.toLowerCase()) : null
        const unit = unitName ? unitsByName.get(unitName.toLowerCase()) : null

        if (!currency || !vat) {
          throw new Error('Invalid currency or VAT rate')
        }

        if (partnerName && !partner) {
          throw new Error(`Partner not found: ${partnerName}`)
        }

        if (unitName && !unit) {
          throw new Error(`Unit not found: ${unitName}`)
        }

        // Parse boolean values
        const parseBoolean = (val: any) => {
          if (typeof val === 'boolean') return val
          const str = String(val || '').toLowerCase()
          return str === 'igen' || str === 'yes' || str === '1' || str === 'true'
        }

        // Prepare material data
        // Get image URL from media library if filename provided
        const imageFilename = String(row['Kép fájlnév'] || '').trim()
        let imageUrl = null
        if (imageFilename) {
          // Try 1: Direct lookup by original filename in media_files
          imageUrl = mediaFilesByOriginalName.get(imageFilename)
          
          if (!imageUrl) {
            // Try 2: Lookup in existing material URLs
            imageUrl = materialUrlsByFilename.get(imageFilename)
          }
          
          if (imageUrl) {
            console.log(`Import: Found image "${imageFilename}" -> ${imageUrl}`)
          } else {
            console.log(`Import: Image "${imageFilename}" not found anywhere - skipping image`)
          }
        }
        
        const materialData = {
          name: String(row['Anyag neve'] || ''),
          brand_id: brand.id,
          length_mm: Number(row['Hossz (mm)'] || 2800),
          width_mm: Number(row['Szélesség (mm)'] || 2070),
          thickness_mm: Number(row['Vastagság (mm)'] || 18),
          grain_direction: parseBoolean(row['Szálirány']),
          on_stock: parseBoolean(row['Raktáron']),
          active: parseBoolean(row['Aktív']),
          base_price: Number(row['Beszerzési ár'] || 0),
          multiplier: Number(row['Árrés szorzó'] || 1.38),
          partners_id: partner?.id || null,
          units_id: unit?.id || null,
          currency_id: currency.id,
          vat_id: vat.id,
          image_url: imageUrl
        }

        const settingsData = {
          kerf_mm: Number(row['Fűrészlap vastagság (mm)'] || 3),
          trim_top_mm: Number(row['Szegélyezés felül (mm)'] || 10),
          trim_right_mm: Number(row['Szegélyezés jobbra (mm)'] || 10),
          trim_bottom_mm: Number(row['Szegélyezés alul (mm)'] || 10),
          trim_left_mm: Number(row['Szegélyezés balra (mm)'] || 10),
          rotatable: parseBoolean(row['Forgatható']),
          waste_multi: Number(row['Hulladék szorzó'] || 1.0),
          usage_limit: Number(row['Kihasználtság küszöb'] || 0.65)
        }

        // Check if material exists by gépkód
        const existingMaterialId = materialsByCode.get(machineCode)

        if (existingMaterialId) {
          // UPDATE existing material
          console.log(`Updating material with gépkód: ${machineCode}, active: ${materialData.active}`)

          console.log(`Updating material data:`, materialData)

          const { error: materialError } = await supabaseServer
            .from('materials')
            .update(materialData)
            .eq('id', existingMaterialId)

          if (materialError) {
            console.error(`Failed to update material ${existingMaterialId}:`, materialError)
            throw materialError
          }
          
          console.log(`Material ${existingMaterialId} updated successfully with active=${materialData.active}`)

          // Update settings
          const { error: settingsError } = await supabaseServer
            .from('material_settings')
            .upsert({
              material_id: existingMaterialId,
              ...settingsData
            }, {
              onConflict: 'material_id'  // Use unique constraint to update existing row
            })

          if (settingsError) {
            console.error(`Failed to update settings for material ${existingMaterialId}:`, settingsError)
            throw settingsError
          }
          
          console.log(`Settings updated for material ${existingMaterialId}:`, settingsData)

          results.updated++
        } else {
          // CREATE new material
          console.log(`Creating new material with gépkód: ${machineCode}`)

          const { data: newMaterial, error: materialError } = await supabaseServer
            .from('materials')
            .insert(materialData)
            .select()
            .single()

          if (materialError) throw materialError

          // Insert settings
          const { error: settingsError } = await supabaseServer
            .from('material_settings')
            .insert({
              material_id: newMaterial.id,
              ...settingsData
            })

          if (settingsError) throw settingsError

          // Insert machine mapping
          const { error: machineError } = await supabaseServer
            .from('machine_material_map')
            .insert({
              material_id: newMaterial.id,
              machine_type: 'Korpus',
              machine_code: machineCode
            })

          if (machineError) throw machineError

          materialsByCode.set(machineCode, newMaterial.id)
          results.created++
        }
      } catch (error) {
        const errorMsg = `Sor ${rowNum}: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
        console.error(errorMsg)
        results.errors.push(errorMsg)
      }
    }

    console.log(`Import complete: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`)

    return NextResponse.json({
      success: true,
      results
    })
  } catch (error) {
    console.error('Error in materials import:', error)
    return NextResponse.json({ 
      error: 'Import failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

