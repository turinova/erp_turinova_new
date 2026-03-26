import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

import { getTenantSupabase } from '@/lib/tenant-supabase'
import { PRODUCT_SUPPLIER_XLSX_COLUMNS, getProductSupplierTemplateRows } from '@/lib/data-operations/product-suppliers-xlsx'

export async function GET() {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const wb = XLSX.utils.book_new()
    const templateRows = getProductSupplierTemplateRows()
    const templateSheet = XLSX.utils.json_to_sheet(templateRows, { header: [...PRODUCT_SUPPLIER_XLSX_COLUMNS] })

    const instructionsRows = [
      { mezo: 'FONTOS', leiras: 'Az exportált fájl szerkezete megegyezik az importtal. Ezt a sablont használd.' },
      { mezo: 'Egyedi kulcs', leiras: 'Elsődleges azonosítás: termek_azonosito (SKU) + beszallito_azonosito (beszállító kód).' },
      { mezo: 'gyartoi_cikkszam', leiras: 'Opcionális kontroll mező. Exportban segít a gyorsabb azonosításban.' },
      { mezo: 'Kötelező mező', leiras: 'termek_azonosito és beszallito_azonosito.' },
      { mezo: 'preferalt', leiras: 'Érték lehet: igen/nem, active/inactive vagy 1/0.' },
      { mezo: 'aktiv', leiras: 'Érték lehet: igen/nem, active/inactive vagy 1/0.' },
      { mezo: 'Webshop push', leiras: 'Ez a folyamat nem indít webshop szinkront.' },
      { mezo: 'Fájl típus', leiras: 'Csak .xlsx támogatott.' }
    ]

    const instructionsSheet = XLSX.utils.json_to_sheet(instructionsRows)
    XLSX.utils.book_append_sheet(wb, templateSheet, 'TermekBeszallitok')
    XLSX.utils.book_append_sheet(wb, instructionsSheet, 'Utmuto')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const timestamp = new Date().toISOString().split('T')[0]
    return new NextResponse(buffer as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="termek_beszallitok_sablon_${timestamp}.xlsx"`
      }
    })
  } catch (error: any) {
    console.error('Product supplier template download error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
