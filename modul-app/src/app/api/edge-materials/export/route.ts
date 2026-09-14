import { NextRequest, NextResponse } from 'next/server'

import { getSessionUser } from '@/lib/auth/session'
import {
  buildEdgeMaterialsExportBuffer,
  buildEdgeMaterialsTemplateBuffer
} from '@/lib/edge-materials/excel-workbook'
import { grossFromNet } from '@/lib/edge-materials/parse'
import { listEdgeMaterialsForExport } from '@/lib/edge-materials/queries'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const mode = request.nextUrl.searchParams.get('mode') ?? 'data'
    if (mode !== 'template' && mode !== 'data') {
      return NextResponse.json(
        { error: 'Érvénytelen mode (template|data).' },
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

    if (mode === 'template') {
      const buffer = await buildEdgeMaterialsTemplateBuffer()
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition':
            'attachment; filename="elzarok_sablon.xlsx"'
        }
      })
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Az adatbázis kapcsolat nem elérhető.' },
        { status: 500 }
      )
    }

    const rows = await listEdgeMaterialsForExport(supabase, user.tenantId)
    const exportRows = rows.map((r) => ({
      manufacturerName: r.manufacturer_name,
      type: r.type,
      decor: r.decor,
      widthMm: r.width_mm,
      thicknessMm: r.thickness_mm,
      priceGross: grossFromNet(r.price_net, r.tax_rate_percent),
      taxRateName: r.tax_rate_name,
      equipmentName: r.equipment_name,
      machineCode: r.machine_code,
      allowanceMm: r.allowance_mm,
      favouritePriority: r.favourite_priority,
      active: r.active
    }))

    const buffer = await buildEdgeMaterialsExportBuffer(exportRows)
    const date = new Date().toISOString().slice(0, 10)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="elzarok_${date}.xlsx"`
      }
    })
  } catch (err) {
    console.error('edge-materials export', err)
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Az export sikertelen.'
      },
      { status: 500 }
    )
  }
}
