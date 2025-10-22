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

    // Fetch existing machine codes
    const { data: existingCodes } = await supabaseServer
      .from('machine_linear_material_map')
      .select('machine_code, linear_material_id')
      .eq('machine_type', 'Korpus')

    const codeMap = new Map(existingCodes?.map(mc => [mc.machine_code, mc.linear_material_id]) || [])

    const preview = []
    const errors = []

    for (let i = 0; i < data.length; i++) {
      const row: any = data[i]
      const rowNum = i + 2

      const requiredFields = {
        'Gépkód': row['Gépkód'],
        'Márka': row['Márka'],
        'Név': row['Név'],
        'Típus': row['Típus'],
        'Aktív': row['Aktív']
      }

      const missing = Object.entries(requiredFields).filter(([_, v]) => !v).map(([k, _]) => k)
      if (missing.length > 0) {
        errors.push(`Sor ${rowNum}: Hiányzó: ${missing.join(', ')}`)
        continue
      }

      if (row['Aktív'] !== 'Igen' && row['Aktív'] !== 'Nem') {
        errors.push(`Sor ${rowNum}: Aktív csak 'Igen' vagy 'Nem' lehet`)
        continue
      }

      const machineCode = row['Gépkód']?.toString().trim()
      const action = codeMap.has(machineCode) ? 'Frissítés' : 'Új'

      // Calculate pricePerM from base_price and multiplier
      const basePrice = parseFloat(row['Beszerzési ár']) || 0
      const multiplier = parseFloat(row['Árrés szorzó']) || 1.38
      const pricePerM = Math.round(basePrice * multiplier)

      preview.push({
        row: rowNum,
        action,
        machineCode,
        brand: row['Márka'],
        name: row['Név'],
        type: row['Típus'],
        pricePerM: pricePerM
      })
    }

    if (errors.length > 0) {
      return NextResponse.json({ success: false, errors, preview: [] }, { status: 400 })
    }

    return NextResponse.json({ success: true, preview, errors: [] })
  } catch (error) {
    console.error('Preview error:', error)
    return NextResponse.json({ success: false, error: 'Preview failed' }, { status: 500 })
  }
}

