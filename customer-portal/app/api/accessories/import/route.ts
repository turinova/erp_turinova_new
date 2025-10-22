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

    // Fetch existing accessories by SKU
    const { data: existingAccessories } = await supabaseServer
      .from('accessories')
      .select('id, sku')
      .is('deleted_at', null)

    const skuMap = new Map(existingAccessories?.map(a => [a.sku, a.id]) || [])

    // Fetch reference data
    const { data: currencies } = await supabaseServer.from('currencies').select('id, name').is('deleted_at', null)
    const { data: vatRates } = await supabaseServer.from('vat').select('id, name, kulcs').is('deleted_at', null)
    const { data: units } = await supabaseServer.from('units').select('id, name').is('deleted_at', null)
    const { data: partners } = await supabaseServer.from('partners').select('id, name').is('deleted_at', null)

    const currencyMap = new Map(currencies?.map(c => [c.name, c.id]) || [])
    const vatMap = new Map(vatRates?.map(v => [`${v.name} (${v.kulcs}%)`, v.id]) || [])
    const unitMap = new Map(units?.map(u => [u.name, u.id]) || [])
    const partnerMap = new Map(partners?.map(p => [p.name, p.id]) || [])

    let successCount = 0
    let errorCount = 0
    const errors = []

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

        const accessoryData = {
          name: row['Név']?.toString().trim(),
          sku: row['SKU']?.toString().trim(),
          base_price: Math.round(basePrice),
          multiplier: parseFloat(multiplier.toFixed(2)),
          net_price: netPrice,
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

        if (existingId) {
          // Update existing
          await supabaseServer.from('accessories').update(accessoryData).eq('id', existingId)
        } else {
          // Create new
          await supabaseServer.from('accessories').insert(accessoryData)
        }

        successCount++

      } catch (error) {
        errors.push(`Sor ${rowNum}: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`)
        errorCount++
      }
    }

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
