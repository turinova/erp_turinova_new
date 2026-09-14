import { NextRequest, NextResponse } from 'next/server'

import { getSessionUser } from '@/lib/auth/session'
import {
  loadQuoteExportData,
  panelsForEquipment
} from '@/lib/quotes/export/load-panels'
import { buildQuoteExcel } from '@/lib/quotes/export/registry'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const equipmentId = request.nextUrl.searchParams.get('equipment_id')?.trim()

    if (!id || id === 'new') {
      return NextResponse.json(
        { error: 'Érvénytelen árajánlat azonosító' },
        { status: 400 }
      )
    }
    if (!equipmentId) {
      return NextResponse.json(
        { error: 'Hiányzik a berendezés (equipment_id).' },
        { status: 400 }
      )
    }

    const user = await getSessionUser()
    if (!user?.tenantId || !user.hasMembership) {
      return NextResponse.json({ error: 'Nincs bejelentkezve.' }, { status: 401 })
    }
    if (user.isDevSession) {
      return NextResponse.json(
        { error: 'Dev bypass módban nincs adatbázis.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Az adatbázis kapcsolat nem elérhető.' },
        { status: 500 }
      )
    }

    const loaded = await loadQuoteExportData(supabase, user.tenantId, id)
    if (!loaded) {
      return NextResponse.json(
        { error: 'Árajánlat nem található' },
        { status: 404 }
      )
    }

    const target = loaded.targets.find((t) => t.equipmentId === equipmentId)
    if (!target) {
      return NextResponse.json(
        {
          error:
            'Ehhez a berendezéshez nincs panel ezen az árajánlaton.'
        },
        { status: 400 }
      )
    }
    if (target.isDeleted) {
      return NextResponse.json(
        {
          error:
            'A berendezés törölve van. Kösd át az anyagot élő gépre a törzsadatokban.'
        },
        { status: 400 }
      )
    }

    const panels = panelsForEquipment(loaded.panels, equipmentId)
    if (panels.length === 0) {
      return NextResponse.json(
        { error: 'Nincs panel az exportáláshoz.' },
        { status: 400 }
      )
    }

    const result = await buildQuoteExcel({
      format: target.exportFormat,
      quoteNumber: loaded.quoteNumber,
      equipmentName: target.equipmentName,
      panels
    })

    return new NextResponse(Buffer.from(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Content-Disposition': `attachment; filename="${result.filename}"`
      }
    })
  } catch (error: unknown) {
    console.error('Error generating Excel:', error)
    const message =
      error instanceof Error ? error.message : 'Ismeretlen hiba'
    return NextResponse.json(
      { error: 'Hiba történt az Excel export során: ' + message },
      { status: 500 }
    )
  }
}
