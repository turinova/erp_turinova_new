import { NextRequest, NextResponse } from 'next/server'

import { getSessionUser } from '@/lib/auth/session'
import {
  buildLinearMaterialsExportBuffer,
  buildLinearMaterialsTemplateBuffer
} from '@/lib/linear-materials/excel-workbook'
import {
  LINEAR_MATERIAL_TYPE_LABELS,
  grossFromNet
} from '@/lib/linear-materials/parse'
import { listLinearMaterialsForExport } from '@/lib/linear-materials/queries'
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
      const buffer = await buildLinearMaterialsTemplateBuffer()
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition':
            'attachment; filename="szalas_anyagok_sablon.xlsx"'
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

    const rows = await listLinearMaterialsForExport(supabase, user.tenantId)
    const exportRows = rows.map((r) => ({
      manufacturerName: r.manufacturer_name,
      materialTypeLabel: LINEAR_MATERIAL_TYPE_LABELS[r.material_type],
      name: r.name,
      lengthMm: r.length_mm,
      widthMm: r.width_mm,
      thicknessMm: r.thickness_mm,
      priceGross: grossFromNet(r.price_net, r.tax_rate_percent),
      taxRateName: r.tax_rate_name,
      onStock: r.on_stock,
      active: r.active
    }))

    const buffer = await buildLinearMaterialsExportBuffer(exportRows)
    const date = new Date().toISOString().slice(0, 10)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="szalas_anyagok_${date}.xlsx"`
      }
    })
  } catch (err) {
    console.error('linear-materials export', err)
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Az export sikertelen.'
      },
      { status: 500 }
    )
  }
}
