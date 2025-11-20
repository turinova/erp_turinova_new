import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page')
    const limit = searchParams.get('limit')
    const idsParam = searchParams.get('ids')
    
    const startTime = Date.now()
    
    let query = supabaseServer
      .from('accessories')
      .select(`
        *,
        vat (name, kulcs),
        currencies (name),
        units (name, shortform),
        partners (name)
      `)
      .is('deleted_at', null)
      .order('name', { ascending: true })
    
    let accessories: any[] = []
    
    // Apply filters based on export type
    if (idsParam) {
      // Export selected items
      const ids = idsParam.split(',')
      query = query.in('id', ids)
      console.log(`[Export] Exporting ${ids.length} selected accessories`)
      
      const { data, error } = await query
      if (error) throw error
      accessories = data || []
      
    } else if (page && limit) {
      // Export current page
      const pageNum = parseInt(page, 10)
      const limitNum = parseInt(limit, 10)
      const offset = (pageNum - 1) * limitNum
      query = query.range(offset, offset + limitNum - 1)
      console.log(`[Export] Exporting page ${pageNum} (${limitNum} records)`)
      
      const { data, error } = await query
      if (error) throw error
      accessories = data || []
      
    } else {
      // Export ALL - need to fetch in chunks to bypass 1000 record limit
      console.log(`[Export] Exporting ALL accessories (fetching in chunks)`)
      
      // First get total count
      const { count } = await supabaseServer
        .from('accessories')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
      
      const totalRecords = count || 0
      console.log(`[Export] Total records to export: ${totalRecords}`)
      
      // Fetch in chunks of 1000 (Supabase default limit)
      const chunkSize = 1000
      const chunks = Math.ceil(totalRecords / chunkSize)
      
      for (let i = 0; i < chunks; i++) {
        const offset = i * chunkSize
        const { data, error } = await supabaseServer
          .from('accessories')
          .select(`
            *,
            vat (name, kulcs),
            currencies (name),
            units (name, shortform),
            partners (name)
          `)
          .is('deleted_at', null)
          .order('name', { ascending: true })
          .range(offset, offset + chunkSize - 1)
        
        if (error) throw error
        
        accessories = accessories.concat(data || [])
        console.log(`[Export] Fetched chunk ${i + 1}/${chunks} (${data?.length || 0} records)`)
      }
      
      console.log(`[Export] ✅ Fetched all ${accessories.length} accessories in ${chunks} chunks`)
    }
    
    const fetchTime = Date.now() - startTime
    console.log(`[Export] Fetched ${accessories?.length || 0} accessories in ${fetchTime}ms`)
    
    // Debug: Check for records with missing data
    const recordsWithMissingData = accessories.filter(a => 
      !a.currencies?.name || !a.units?.name || !a.partners?.name
    )
    if (recordsWithMissingData.length > 0) {
      console.warn(`[Export] ⚠️ Found ${recordsWithMissingData.length} accessories with missing currency/unit/partner:`)
      recordsWithMissingData.forEach((acc, idx) => {
        console.warn(`  ${idx + 1}. SKU: ${acc.sku}, Name: ${acc.name}, Missing: ${
          [
            !acc.currencies?.name && 'currency',
            !acc.units?.name && 'unit',
            !acc.partners?.name && 'partner'
          ].filter(Boolean).join(', ')
        }, deleted_at: ${acc.deleted_at}`)
      })
    }
    
    // Filter out records with missing required data to prevent import errors
    const validAccessories = accessories.filter(a => 
      a.name && a.sku && a.currencies?.name && a.units?.name && a.partners?.name
    )
    
    if (validAccessories.length < accessories.length) {
      const skippedCount = accessories.length - validAccessories.length
      console.warn(`[Export] ⚠️ Skipping ${skippedCount} accessories with missing required data`)
    }
    
    console.log(`[Export] Exporting ${validAccessories.length} valid accessories`)

    // Fetch media files to map image_url to original filename
    const { data: mediaFiles } = await supabaseServer
      .from('media_files')
      .select('original_filename, full_url, stored_filename')
    
    // Create map with normalized URLs (remove trailing slashes, etc.)
    const normalizeUrl = (url: string) => url.trim().replace(/\/$/, '')
    const mediaUrlMap = new Map(mediaFiles?.map(m => [normalizeUrl(m.full_url), m.original_filename]) || [])
    
    // Also create map by stored_filename for fallback lookup
    const extractStoredFilename = (url: string): string | null => {
      const parts = url.split('/')
      return parts[parts.length - 1] || null
    }
    const mediaFilenameMap = new Map(mediaFiles?.map(m => [m.stored_filename, m.original_filename]) || [])
    
    // Debug: Log first few media files
    if (mediaFiles && mediaFiles.length > 0) {
      console.log(`[Export] Loaded ${mediaFiles.length} media files for lookup`)
      console.log(`[Export] Sample media files:`, mediaFiles.slice(0, 3).map(m => ({
        original: m.original_filename,
        stored: m.stored_filename,
        url: m.full_url
      })))
    }
    
    // Helper function to get original filename from image_url
    const getOriginalFilename = (imageUrl: string | null | undefined): string => {
      if (!imageUrl) return ''
      
      const normalizedImageUrl = normalizeUrl(imageUrl)
      
      // First try: Direct lookup in media_files table by full_url (normalized)
      const originalName = mediaUrlMap.get(normalizedImageUrl)
      if (originalName) {
        console.log(`[Export] Found original filename for ${imageUrl}: ${originalName}`)
        return originalName
      }
      
      // Second try: Lookup by stored_filename (extract from URL)
      const storedFilename = extractStoredFilename(imageUrl)
      if (storedFilename) {
        const originalNameByFilename = mediaFilenameMap.get(storedFilename)
        if (originalNameByFilename) {
          console.log(`[Export] Found original filename by stored_filename for ${imageUrl}: ${originalNameByFilename}`)
          return originalNameByFilename
        }
      }
      
      // Debug: Log if not found
      console.log(`[Export] No media_files record found for URL: ${imageUrl} (stored_filename: ${storedFilename})`)
      
      // Fallback: Try to extract original filename from stored filename pattern
      // For accessories: URL format: https://.../accessories/accessories/{uuid}-{timestamp}.{ext}
      // For materials: URL format: https://.../materials/materials/{timestamp}-{original}.{ext}
      
      // Try accessories pattern first (uuid-timestamp.ext)
      const accessoriesMatch = imageUrl.match(/accessories\/accessories\/[a-f0-9-]+-(\d+)\.(webp|png|jpeg|jpg|gif)$/i)
      if (accessoriesMatch) {
        // For accessories, we can't extract original filename from stored name
        // Return empty string - user needs to register the file or re-upload
        return ''
      }
      
      // Try materials pattern (timestamp-original.ext)
      const materialsMatch = imageUrl.match(/materials\/materials\/\d+-(.+\.(webp|png|jpeg|jpg|gif))$/)
      if (materialsMatch) {
        return materialsMatch[1] // Return the original filename part
      }
      
      // Last resort: extract any filename from the URL
      const urlParts = imageUrl.split('/')
      const filename = urlParts[urlParts.length - 1]
      return filename || ''
    }

    // Transform for Excel with base_price and multiplier
    const excelData = validAccessories?.map(accessory => {
      return {
        'Név': accessory.name,
        'SKU': accessory.sku,
        'Vonalkód': accessory.barcode || '',
        'Beszerzési ár (Ft)': accessory.base_price,
        'Árrés szorzó': accessory.multiplier,
        'ÁFA': `${accessory.vat?.name || ''} (${accessory.vat?.kulcs || 0}%)`,
        'Pénznem': accessory.currencies?.name || '',
        'Mértékegység': accessory.units?.name || '',
        'Partner': accessory.partners?.name || '',
        'Kép fájlnév': getOriginalFilename(accessory.image_url)
      }
    }) || []

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(excelData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Accessories')

    // Set column widths
    ws['!cols'] = [
      { wch: 30 }, // Név
      { wch: 15 }, // SKU
      { wch: 15 }, // Vonalkód
      { wch: 15 }, // Beszerzési ár (Ft)
      { wch: 10 }, // Árrés szorzó
      { wch: 20 }, // ÁFA
      { wch: 10 }, // Pénznem
      { wch: 15 }, // Mértékegység
      { wch: 20 }, // Partner
      { wch: 25 }  // Kép fájlnév
    ]

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    
    const totalTime = Date.now() - startTime
    console.log(`[Export] ✅ Complete! Generated Excel file with ${validAccessories?.length || 0} records in ${totalTime}ms`)

    // Return file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="accessories.xlsx"'
      }
    })

  } catch (error) {
    console.error('[Export] ❌ Error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
