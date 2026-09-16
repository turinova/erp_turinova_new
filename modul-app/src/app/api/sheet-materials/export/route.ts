import { NextRequest, NextResponse } from 'next/server'

import { getSessionUser } from '@/lib/auth/session'
import { mapPublicUrlsToFilenames } from '@/lib/media/queries'
import {
  buildSheetMaterialsExportBuffer,
  buildSheetMaterialsTemplateBuffer
} from '@/lib/sheet-materials/excel-workbook'
import { grossFromNet } from '@/lib/sheet-materials/parse'
import { listSheetMaterialsForExport } from '@/lib/sheet-materials/queries'
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
      const buffer = await buildSheetMaterialsTemplateBuffer()
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition':
            'attachment; filename="tablas_anyagok_sablon.xlsx"'
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

    const [rows, urlToName] = await Promise.all([
      listSheetMaterialsForExport(supabase, user.tenantId),
      mapPublicUrlsToFilenames(supabase, user.tenantId)
    ])
    const exportRows = rows.map((r) => ({
      manufacturerName: r.manufacturer_name,
      name: r.name,
      lengthMm: r.length_mm,
      widthMm: r.width_mm,
      thicknessMm: r.thickness_mm,
      priceGross: grossFromNet(r.price_net, r.tax_rate_percent),
      taxRateName: r.tax_rate_name,
      equipmentName: r.equipment_name,
      machineCode: r.machine_code,
      onStock: r.on_stock,
      active: r.active,
      trimTopMm: r.trim_top_mm,
      trimRightMm: r.trim_right_mm,
      trimBottomMm: r.trim_bottom_mm,
      trimLeftMm: r.trim_left_mm,
      kerfMm: r.kerf_mm,
      wasteMulti: r.waste_multi,
      usageLimitPercent: Math.round(r.usage_limit * 1000) / 10,
      grainDirection: r.grain_direction,
      rotatable: r.rotatable,
      imageFilename: r.image_url
        ? (urlToName.get(r.image_url.split('?')[0]) ?? null)
        : null
    }))

    const buffer = await buildSheetMaterialsExportBuffer(exportRows)
    const date = new Date().toISOString().slice(0, 10)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="tablas_anyagok_${date}.xlsx"`
      }
    })
  } catch (err) {
    console.error('sheet-materials export', err)
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Az export sikertelen.'
      },
      { status: 500 }
    )
  }
}
