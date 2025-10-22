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

    console.log(`Importing ${data.length} edge materials`)

    // Fetch existing machine codes
    const { data: existingMachineCodes } = await supabaseServer
      .from('machine_edge_material_map')
      .select('machine_code, edge_material_id')
      .eq('machine_type', 'Korpus')

    const machineCodeMap = new Map(
      existingMachineCodes?.map(mc => [mc.machine_code, mc.edge_material_id]) || []
    )

    // Fetch all brands and VAT rates
    const { data: brands } = await supabaseServer
      .from('brands')
      .select('id, name')
      .is('deleted_at', null)

    const { data: vatRates } = await supabaseServer
      .from('vat')
      .select('id, name, kulcs')

    const brandMap = new Map(brands?.map(b => [b.name, b.id]) || [])
    const vatMap = new Map(vatRates?.map(v => [`${v.name} (${v.kulcs}%)`, v.id]) || [])

    let created = 0
    let updated = 0
    const errors = []

    for (let i = 0; i < data.length; i++) {
      const row: any = data[i]
      const rowNum = i + 2

      try {
        const machineCode = row['Gépkód']?.toString().trim()
        const brandName = row['Márka']?.toString().trim()
        const vatString = row['Adónem']?.toString().trim()
        
        // Get or create brand
        let brandId = brandMap.get(brandName)
        if (!brandId) {
          const { data: newBrand, error: brandError } = await supabaseServer
            .from('brands')
            .insert({ name: brandName })
            .select('id')
            .single()

          if (brandError) {
            errors.push(`Sor ${rowNum}: Márka létrehozási hiba: ${brandError.message}`)
            continue
          }

          brandId = newBrand.id
          brandMap.set(brandName, brandId)
        }

        // Get VAT ID
        const vatId = vatMap.get(vatString)
        if (!vatId) {
          errors.push(`Sor ${rowNum}: Ismeretlen adónem: ${vatString}`)
          continue
        }

        // Parse active status
        const active = row['Aktív'] === 'Igen'

        // Parse favourite_priority
        const favouritePriorityValue = row['Kedvenc sorrend']
        const favouritePriority = favouritePriorityValue && favouritePriorityValue !== '' 
          ? parseInt(favouritePriorityValue.toString()) 
          : null

        // Get VAT rate for gross to net conversion
        const vatRate = vatRates?.find(v => v.id === vatId)?.kulcs || 0
        
        // Parse gross price and convert to net price
        const grossPrice = parseFloat(row['Bruttó ár (Ft)']) || parseFloat(row['Ár (Ft)']) || 0
        const netPrice = Math.round(grossPrice / (1 + vatRate / 100))

        // Prepare edge material data
        const edgeMaterialData = {
          brand_id: brandId,
          type: row['Típus']?.toString().trim(),
          decor: row['Dekor']?.toString().trim(),
          width: parseFloat(row['Szélesség (mm)']) || 0,
          thickness: parseFloat(row['Vastagság (mm)']) || 0,
          price: netPrice,
          vat_id: vatId,
          ráhagyás: parseInt(row['Ráhagyás (mm)']) || 0,
          favourite_priority: favouritePriority,
          active: active,
        }

        const existingEdgeMaterialId = machineCodeMap.get(machineCode)

        if (existingEdgeMaterialId) {
          // Update existing edge material
          const { error: updateError } = await supabaseServer
            .from('edge_materials')
            .update(edgeMaterialData)
            .eq('id', existingEdgeMaterialId)

          if (updateError) {
            errors.push(`Sor ${rowNum}: Frissítési hiba: ${updateError.message}`)
            continue
          }

          // Update machine code (even if it's the same)
          await supabaseServer
            .from('machine_edge_material_map')
            .update({ machine_code: machineCode })
            .eq('edge_material_id', existingEdgeMaterialId)
            .eq('machine_type', 'Korpus')

          updated++
          console.log(`Updated edge material: ${machineCode}`)
        } else {
          // Create new edge material
          const { data: newEdgeMaterial, error: createError } = await supabaseServer
            .from('edge_materials')
            .insert(edgeMaterialData)
            .select('id')
            .single()

          if (createError) {
            errors.push(`Sor ${rowNum}: Létrehozási hiba: ${createError.message}`)
            continue
          }

          // Insert machine code
          const { error: machineCodeError } = await supabaseServer
            .from('machine_edge_material_map')
            .insert({
              edge_material_id: newEdgeMaterial.id,
              machine_type: 'Korpus',
              machine_code: machineCode
            })

          if (machineCodeError) {
            errors.push(`Sor ${rowNum}: Gépkód hozzáadási hiba: ${machineCodeError.message}`)
            // Rollback: delete the created edge material
            await supabaseServer
              .from('edge_materials')
              .delete()
              .eq('id', newEdgeMaterial.id)
            continue
          }

          created++
          console.log(`Created edge material: ${machineCode}`)
        }
      } catch (error) {
        errors.push(`Sor ${rowNum}: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`)
      }
    }

    console.log(`Import complete: ${created} created, ${updated} updated, ${errors.length} errors`)

    return NextResponse.json({
      success: true,
      created,
      updated,
      errors
    })

  } catch (error) {
    console.error('Error importing edge materials:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Import failed',
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }, { status: 500 })
  }
}

