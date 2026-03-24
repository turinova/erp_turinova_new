import { NextResponse } from 'next/server'

import * as XLSX from 'xlsx'

import { getTenantSupabase } from '@/lib/tenant-supabase'
import { SUPPLIER_XLSX_COLUMNS, getSupplierTemplateRows } from '@/lib/data-operations/suppliers-xlsx'

export async function GET() {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const wb = XLSX.utils.book_new()
    const templateRows = getSupplierTemplateRows()
    const templateSheet = XLSX.utils.json_to_sheet(templateRows, { header: [...SUPPLIER_XLSX_COLUMNS] })

    const instructionsRows = [
      { mező: 'FONTOS', leírás: 'Az exportált fájl szerkezete megegyezik az importtal. Ezt a sablont használd.' },
      { mező: 'Egyedi kulcs', leírás: 'Elsődleges azonosítás: azonosito (Beszállító kód).' },
      { mező: 'Kötelező mező', leírás: 'azonosito és nev' },
      { mező: 'statusz', leírás: 'Csak active vagy inactive lehet.' },
      { mező: 'fizetesi_mod / afa / penznem', leírás: 'Értékeknek a rendszerben létező fizetési mód, ÁFA és pénznem adatokkal kell egyezniük.' },
      { mező: 'Fájl típus', leírás: 'Csak .xlsx támogatott.' }
    ]

    const instructionsSheet = XLSX.utils.json_to_sheet(instructionsRows)

    XLSX.utils.book_append_sheet(wb, templateSheet, 'Beszallitok')
    XLSX.utils.book_append_sheet(wb, instructionsSheet, 'Utmuto')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const timestamp = new Date().toISOString().split('T')[0]

    return new NextResponse(buffer as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="beszallitok_sablon_${timestamp}.xlsx"`
      }
    })
  } catch (error: any) {
    console.error('Supplier template download error:', error)
    
return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
