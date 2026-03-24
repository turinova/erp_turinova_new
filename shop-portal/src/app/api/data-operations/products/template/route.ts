import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

import { getTenantSupabase } from '@/lib/tenant-supabase'
import { PRODUCT_XLSX_COLUMNS, getProductTemplateRows } from '@/lib/data-operations/products-xlsx'

export async function GET() {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const wb = XLSX.utils.book_new()
    const templateRows = getProductTemplateRows()
    const templateSheet = XLSX.utils.json_to_sheet(templateRows, { header: [...PRODUCT_XLSX_COLUMNS] })

    const instructionsRows = [
      { mezo: 'FONTOS', leiras: 'Az exportált fájl szerkezete megegyezik az importtal. Ezt a sablont használd.' },
      { mezo: 'Egyedi kulcs', leiras: 'Elsődleges azonosítás: azonosito (SKU).' },
      { mezo: 'Kötelező mező', leiras: 'azonosito mindig kötelező.' },
      { mezo: 'Árazás', leiras: 'Ha bármelyik ár mezőt kitöltöd, kötelező mindhárom: beszerzesi_ar, arazasi_szorzo, afa.' },
      { mezo: 'Árszámítás', leiras: 'netto_ar és brutto_ar a rendszerben kerül kiszámításra, importban nem kell megadni.' },
      { mezo: 'statusz', leiras: 'Csak active/inactive vagy 1/0 lehet.' },
      { mezo: 'Fájl típus', leiras: 'Csak .xlsx támogatott.' }
    ]

    const instructionsSheet = XLSX.utils.json_to_sheet(instructionsRows)
    XLSX.utils.book_append_sheet(wb, templateSheet, 'Termekek')
    XLSX.utils.book_append_sheet(wb, instructionsSheet, 'Utmuto')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const timestamp = new Date().toISOString().split('T')[0]

    return new NextResponse(buffer as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="termekek_sablon_${timestamp}.xlsx"`
      }
    })
  } catch (error: any) {
    console.error('Product template download error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
