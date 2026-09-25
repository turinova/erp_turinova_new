import { NextRequest, NextResponse } from 'next/server'

import { buildAccessoriesWorkbook, type AccessoryExcelLists } from '@/lib/accessories/excel-workbook'
import { XLSX_TYPE } from '@/lib/accessories/import-route'
import {
  listAccessories,
  listAccessoryManufacturerOptions,
  listAccessoryTaxOptions,
  listAccessoryUnitOptions
} from '@/lib/accessories/queries'
import { getSessionUser } from '@/lib/auth/session'
import { mapPublicUrlsToFilenames } from '@/lib/media/queries'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

function xlsx(buffer: Buffer, filename: string): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': XLSX_TYPE,
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    const mode = request.nextUrl.searchParams.get('mode') ?? 'data'
    if (mode !== 'template' && mode !== 'data') {
      return NextResponse.json({ error: 'Érvénytelen mode (template|data).' }, { status: 400 })
    }

    const user = await getSessionUser()
    if (!user?.tenantId || !user.hasMembership) {
      return NextResponse.json({ error: 'Nincs bejelentkezve.' }, { status: 401 })
    }
    if (user.isDevSession) {
      return NextResponse.json({ error: 'Dev bypass módban nincs adatbázis.' }, { status: 400 })
    }
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Az adatbázis kapcsolat nem elérhető.' }, { status: 500 })
    }

    const [manufacturers, taxRates, units] = await Promise.all([
      listAccessoryManufacturerOptions(supabase, user.tenantId),
      listAccessoryTaxOptions(supabase, user.tenantId),
      listAccessoryUnitOptions(supabase, user.tenantId)
    ])
    const lists: AccessoryExcelLists = {
      manufacturers: manufacturers.map((m) => m.name),
      taxRates: taxRates.map((t) => t.name),
      units: units.map((u) => u.shortform)
    }
    const date = new Date().toISOString().slice(0, 10)

    if (mode === 'template') {
      return xlsx(await buildAccessoriesWorkbook([], lists, { template: true }), 'termekek_sablon.xlsx')
    }

    const [rows, urlToName] = await Promise.all([
      listAccessories(supabase, user.tenantId),
      mapPublicUrlsToFilenames(supabase, user.tenantId)
    ])
    const buffer = await buildAccessoriesWorkbook(
      rows.map((r) => ({
        id: r.id,
        manufacturerName: r.manufacturer_name,
        name: r.name,
        sku: r.sku,
        barcode: r.barcode,
        barcodeInternal: r.barcode_internal,
        priceGross: r.price_gross,
        purchasePriceNet: r.purchase_price_net,
        marginFactor: r.margin_factor,
        taxRateName: r.tax_rate_name,
        unitLabel: r.unit_shortform,
        active: r.active,
        imageFilename: r.image_url ? (urlToName.get(r.image_url.split('?')[0]) ?? null) : null,
        gallery: r.web_gallery.map((url) => urlToName.get(url.split('?')[0]) ?? url)
      })),
      lists,
      { template: false }
    )
    return xlsx(buffer, `termekek_${date}.xlsx`)
  } catch (err) {
    console.error('accessories export', err)
    return NextResponse.json({ error: 'A letöltés nem sikerült. Próbáld újra.' }, { status: 500 })
  }
}
