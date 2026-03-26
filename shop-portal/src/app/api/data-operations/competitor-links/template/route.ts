import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

import { getTenantSupabase } from '@/lib/tenant-supabase'
import { COMPETITOR_LINK_XLSX_COLUMNS, getCompetitorLinkTemplateRows } from '@/lib/data-operations/competitor-links-xlsx'

export async function GET() {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const wb = XLSX.utils.book_new()
    const templateRows = getCompetitorLinkTemplateRows()
    const templateSheet = XLSX.utils.json_to_sheet(templateRows, { header: [...COMPETITOR_LINK_XLSX_COLUMNS] })

    const instructionsRows = [
      { mezo: 'FONTOS', leiras: 'Az exportált fájl szerkezete megegyezik az importtal. Ezt a sablont használd.' },
      { mezo: 'Egyedi kulcs', leiras: 'Elsődleges azonosítás: termek_azonosito (SKU) + versenytars.' },
      { mezo: 'Kötelező mezők', leiras: 'termek_azonosito, versenytars, versenytars_url.' },
      { mezo: 'gyartoi_cikkszam', leiras: 'Opcionális ellenőrző mező. Eltérés esetén a sor hibára fut.' },
      { mezo: 'aktiv', leiras: 'Érték lehet: igen/nem, active/inactive vagy 1/0.' },
      { mezo: 'Kalkulált mezők', leiras: 'Nincsenek. Ár/statisztikai mezőket ez a folyamat nem importál.' },
      { mezo: 'Fájl típus', leiras: 'Csak .xlsx támogatott.' }
    ]
    const instructionsSheet = XLSX.utils.json_to_sheet(instructionsRows)

    XLSX.utils.book_append_sheet(wb, templateSheet, 'VersenytarsLinkek')
    XLSX.utils.book_append_sheet(wb, instructionsSheet, 'Utmuto')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const timestamp = new Date().toISOString().split('T')[0]
    return new NextResponse(buffer as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="versenytars_linkek_sablon_${timestamp}.xlsx"`
      }
    })
  } catch (error: any) {
    console.error('Competitor link template download error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
