import { NextRequest, NextResponse } from 'next/server'

import {
  buildAccessoriesExportBuffer,
  buildAccessoriesTemplateBuffer
} from '@/lib/accessories/excel-workbook'
import { listAccessories } from '@/lib/accessories/queries'
import { getSessionUser } from '@/lib/auth/session'
import { mapPublicUrlsToFilenames } from '@/lib/media/queries'
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
      const buffer = await buildAccessoriesTemplateBuffer()
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition':
            'attachment; filename="termekek_sablon.xlsx"'
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
      listAccessories(supabase, user.tenantId),
      mapPublicUrlsToFilenames(supabase, user.tenantId)
    ])
    const exportRows = rows.map((r) => ({
      manufacturerName: r.manufacturer_name,
      name: r.name,
      sku: r.sku,
      barcode: r.barcode,
      barcodeInternal: r.barcode_internal,
      priceGross: r.price_gross,
      taxRateName: r.tax_rate_name,
      unitLabel: r.unit_shortform,
      active: r.active,
      imageFilename: r.image_url
        ? (urlToName.get(r.image_url.split('?')[0]) ?? null)
        : null
    }))

    const buffer = await buildAccessoriesExportBuffer(exportRows)
    const date = new Date().toISOString().slice(0, 10)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="termekek_${date}.xlsx"`
      }
    })
  } catch (err) {
    console.error('accessories export', err)
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Az export sikertelen.'
      },
      { status: 500 }
    )
  }
}
