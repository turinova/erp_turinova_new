import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const workbook = XLSX.read(Buffer.from(bytes), { type: 'buffer' })
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])

    // Fetch ALL existing accessories by SKU (in chunks to bypass 1000 limit)
    console.log('[Import] Fetching existing accessories for SKU lookup...')
    const { count: totalExisting } = await supabaseServer
      .from('accessories')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
    
    let allExistingAccessories: any[] = []
    const chunkSize = 1000
    const chunks = Math.ceil((totalExisting || 0) / chunkSize)
    
    for (let i = 0; i < chunks; i++) {
      const offset = i * chunkSize
      const { data } = await supabaseServer
        .from('accessories')
        .select('id, sku')
        .is('deleted_at', null)
        .range(offset, offset + chunkSize - 1)
      
      allExistingAccessories = allExistingAccessories.concat(data || [])
    }
    
    console.log(`[Import] Loaded ${allExistingAccessories.length} existing accessories for comparison`)
    const skuMap = new Map(allExistingAccessories.map(a => [a.sku, a.id]))
    console.log(`[Import] SKU Map size: ${skuMap.size} unique SKUs`)
    
    // Debug: Check first few SKUs
    const sampleSKUs = Array.from(skuMap.keys()).slice(0, 5)
    console.log(`[Import] Sample SKUs in map:`, sampleSKUs)

    // Fetch reference data
    const [currenciesRes, vatRatesRes, unitsRes, partnersRes, mediaFilesRes] = await Promise.all([
      supabaseServer.from('currencies').select('id, name').is('deleted_at', null),
      supabaseServer.from('vat').select('id, name, kulcs').is('deleted_at', null),
      supabaseServer.from('units').select('id, name').is('deleted_at', null),
      supabaseServer.from('partners').select('id, name').is('deleted_at', null),
      supabaseServer.from('media_files').select('original_filename, stored_filename, full_url')
    ])

    const currencies = currenciesRes.data || []
    const vatRates = vatRatesRes.data || []
    const units = unitsRes.data || []
    const partners = partnersRes.data || []
    const mediaFiles = mediaFilesRes.data || []

    const currencyMap = new Map(currencies.map(c => [c.name, c.id]))
    const vatMap = new Map(vatRates.map(v => [`${v.name} (${v.kulcs}%)`, v.id]))
    const unitMap = new Map(units.map(u => [u.name, u.id]))
    const partnerMap = new Map(partners.map(p => [p.name, p.id]))
    const mediaFilesByOriginalName = new Map(mediaFiles.map(m => [m.original_filename, m.full_url]))

    console.log(`[Import] Processing ${data.length} records from Excel file`)
    const startTime = Date.now()
    
    let successCount = 0
    let errorCount = 0
    const errors: string[] = []
    const recordsToUpsert: any[] = []
    const recordsToUpdate: any[] = []

    // Step 1: Parse and validate all rows (fast, in-memory)
    for (let i = 0; i < data.length; i++) {
      const row: any = data[i]
      const rowNum = i + 2

      try {
        // Parse base_price and multiplier
        const basePrice = parseFloat(row['Beszerzési ár (Ft)']) || 0
        const multiplier = parseFloat(row['Árrés szorzó']) || 1.38
        const vatString = row['ÁFA']?.toString().trim()
        const vatId = vatMap.get(vatString)
        
        if (!vatId) {
          errors.push(`Sor ${rowNum}: Érvénytelen ÁFA: ${vatString}`)
          errorCount++
          continue
        }

        // Calculate net_price from base_price * multiplier
        const netPrice = Math.round(basePrice * multiplier)

        // Get image URL from media library if filename provided
        const imageFilename = String(row['Kép fájlnév'] || '').trim()
        let imageUrl = null
        if (imageFilename) {
          imageUrl = mediaFilesByOriginalName.get(imageFilename)
          if (imageUrl) {
            console.log(`[Import] Found image "${imageFilename}" -> ${imageUrl}`)
          } else {
            console.log(`[Import] Image "${imageFilename}" not found - skipping image`)
          }
        }

        const accessoryData = {
          name: row['Név']?.toString().trim(),
          sku: row['SKU']?.toString().trim(),
          barcode: row['Vonalkód'] ? String(row['Vonalkód']).trim() : null,
          base_price: Math.round(basePrice),
          multiplier: parseFloat(multiplier.toFixed(2)),
          net_price: netPrice,
          image_url: imageUrl,
          vat_id: vatId,
          currency_id: currencyMap.get(row['Pénznem']?.toString().trim()),
          units_id: unitMap.get(row['Mértékegység']?.toString().trim()),
          partners_id: partnerMap.get(row['Partner']?.toString().trim())
        }

        // Validate required fields
        if (!accessoryData.name || !accessoryData.sku || !accessoryData.currency_id || !accessoryData.units_id || !accessoryData.partners_id) {
          errors.push(`Sor ${rowNum}: Hiányzó kötelező mezők`)
          errorCount++
          continue
        }

        const existingId = skuMap.get(accessoryData.sku)
        
        // Debug: Log first 3 SKU lookups
        if (i < 3) {
          console.log(`[Import] Row ${rowNum} SKU: "${accessoryData.sku}" → ${existingId ? 'UPDATE (found)' : 'INSERT (new)'}`)
        }

        if (existingId) {
          // Mark for update
          recordsToUpdate.push({ ...accessoryData, id: existingId })
        } else {
          // Mark for insert
          recordsToUpsert.push(accessoryData)
        }

      } catch (error) {
        errors.push(`Sor ${rowNum}: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`)
        errorCount++
      }
    }
    
    const parseTime = Date.now() - startTime
    console.log(`[Import] Parsed ${data.length} rows in ${parseTime}ms - ${recordsToUpsert.length} new, ${recordsToUpdate.length} updates, ${errorCount} errors`)
    
    // Step 2: Batch insert new records in chunks of 500
    if (recordsToUpsert.length > 0) {
      const chunkSize = 500
      const insertChunks = Math.ceil(recordsToUpsert.length / chunkSize)
      
      for (let i = 0; i < insertChunks; i++) {
        const chunk = recordsToUpsert.slice(i * chunkSize, (i + 1) * chunkSize)
        const { error: insertError } = await supabaseServer
          .from('accessories')
          .insert(chunk)
        
        if (insertError) {
          console.error(`[Import] Error inserting chunk ${i + 1}:`, insertError)
          errorCount += chunk.length
          errors.push(`Batch insert chunk ${i + 1} failed: ${insertError.message}`)
        } else {
          successCount += chunk.length
          console.log(`[Import] Inserted chunk ${i + 1}/${insertChunks} (${chunk.length} records)`)
        }
      }
    }
    
    // Step 3: Batch update existing records in chunks of 500
    if (recordsToUpdate.length > 0) {
      const chunkSize = 500
      const updateChunks = Math.ceil(recordsToUpdate.length / chunkSize)
      
      for (let i = 0; i < updateChunks; i++) {
        const chunk = recordsToUpdate.slice(i * chunkSize, (i + 1) * chunkSize)
        
        // Upsert with conflict resolution on id
        const { error: updateError } = await supabaseServer
          .from('accessories')
          .upsert(chunk, { onConflict: 'id' })
        
        if (updateError) {
          console.error(`[Import] Error updating chunk ${i + 1}:`, updateError)
          errorCount += chunk.length
          errors.push(`Batch update chunk ${i + 1} failed: ${updateError.message}`)
        } else {
          successCount += chunk.length
          console.log(`[Import] Updated chunk ${i + 1}/${updateChunks} (${chunk.length} records)`)
        }
      }
    }
    
    const totalTime = Date.now() - startTime
    console.log(`[Import] ✅ Complete! Processed ${successCount} records in ${totalTime}ms (${errorCount} errors)`)

    if (errors.length > 0) {
      return NextResponse.json({ 
        error: 'Import completed with errors', 
        details: errors,
        successCount,
        errorCount 
      }, { status: 400 })
    }

    return NextResponse.json({ 
      message: 'Import successful', 
      successCount,
      errorCount: 0 
    })

  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
