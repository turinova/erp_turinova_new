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

    // Transform for Excel with base_price and multiplier
    const excelData = accessories?.map(accessory => {
      return {
        'Név': accessory.name,
        'SKU': accessory.sku,
               'Beszerzési ár (Ft)': accessory.base_price,
               'Árrés szorzó': accessory.multiplier,
        'ÁFA': `${accessory.vat?.name || ''} (${accessory.vat?.kulcs || 0}%)`,
        'Pénznem': accessory.currencies?.name || '',
        'Mértékegység': accessory.units?.name || '',
        'Partner': accessory.partners?.name || ''
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
             { wch: 15 }, // Beszerzési ár (Ft)
             { wch: 10 }, // Árrés szorzó
      { wch: 20 }, // ÁFA
      { wch: 10 }, // Pénznem
      { wch: 15 }, // Mértékegység
      { wch: 20 }  // Partner
    ]

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    
    const totalTime = Date.now() - startTime
    console.log(`[Export] ✅ Complete! Generated Excel file with ${accessories?.length || 0} records in ${totalTime}ms`)

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
