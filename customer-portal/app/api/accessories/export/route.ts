import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  try {
    const { data: accessories, error } = await supabaseServer
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

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch accessories', details: error.message }, { status: 500 })
    }

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

    // Return file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="accessories.xlsx"'
      }
    })

  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
