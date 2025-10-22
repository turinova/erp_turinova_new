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

    const preview = []
    const errors = []

    for (let i = 0; i < data.length; i++) {
      const row: any = data[i]
      const rowNum = i + 2

      const requiredFields = {
        'Név': row['Név'],
        'SKU': row['SKU'],
        'Beszerzési ár (Ft)': row['Beszerzési ár (Ft)'],
        'Árrés szorzó': row['Árrés szorzó'],
        'ÁFA': row['ÁFA'],
        'Pénznem': row['Pénznem'],
        'Mértékegység': row['Mértékegység'],
        'Partner': row['Partner']
      }

      const missing = Object.entries(requiredFields).filter(([_, v]) => !v).map(([k, _]) => k)
      if (missing.length > 0) {
        errors.push(`Sor ${rowNum}: Hiányzó mezők: ${missing.join(', ')}`)
        continue
      }

      const sku = row['SKU']?.toString().trim()
      const action = skuMap.has(sku) ? 'Frissítés' : 'Új'

      // Parse base_price and multiplier
      const basePrice = parseFloat(row['Beszerzési ár (Ft)']) || 0
      const multiplier = parseFloat(row['Árrés szorzó']) || 1.38
      const vatString = row['ÁFA']?.toString().trim()
      const vatId = vatMap.get(vatString)
      
      if (!vatId) {
        errors.push(`Sor ${rowNum}: Érvénytelen ÁFA: ${vatString}`)
        continue
      }

      // Calculate net_price from base_price * multiplier
      const netPrice = Math.round(basePrice * multiplier)

      preview.push({
        row: rowNum,
        action,
        sku,
        name: row['Név'],
        basePrice,
        multiplier,
        vat: vatString,
        currency: row['Pénznem'],
        unit: row['Mértékegység'],
        partner: row['Partner']
      })
    }

    if (errors.length > 0) {
      return NextResponse.json({ 
        error: 'Validation errors', 
        details: errors 
      }, { status: 400 })
    }

    return NextResponse.json({ preview })

  } catch (error) {
    console.error('Preview error:', error)
    return NextResponse.json({ error: 'Preview failed' }, { status: 500 })
  }
}
