import { NextRequest, NextResponse } from 'next/server'

import { buildAccessoriesWorkbook, type AccessoryExcelLists } from '@/lib/accessories/excel-workbook'
import { XLSX_TYPE } from '@/lib/accessories/import-route'
import {
  ACCESSORY_EXPORT_MAX_ROWS,
  ACCESSORY_WEB_FILTERS,
  AccessoryExportNeedsFilterError,
  AccessoryExportTooLargeError,
  listAccessoriesForExport,
  listAccessoryManufacturerOptions,
  listAccessoryTaxOptions,
  listAccessoryUnitOptions,
  type AccessoryExportScope,
  type AccessoryWebFilter
} from '@/lib/accessories/queries'
import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'

export const maxDuration = 60

function xlsx(buffer: Buffer, filename: string): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': XLSX_TYPE,
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  })
}

function parseWeb(raw: string | null): AccessoryWebFilter {
  if (raw && (ACCESSORY_WEB_FILTERS as readonly string[]).includes(raw)) {
    return raw as AccessoryWebFilter
  }
  return 'all'
}

function parseScope(raw: string | null): AccessoryExportScope {
  return raw === 'all' ? 'all' : 'hits'
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

    const q = (request.nextUrl.searchParams.get('q') ?? '').slice(0, 80)
    const web = parseWeb(request.nextUrl.searchParams.get('web'))
    const scope = parseScope(request.nextUrl.searchParams.get('scope'))
    const hasWebshop = await tenantHasWebshop(supabase, user.tenantId)

    const { rows, truncated } = await listAccessoriesForExport(supabase, user.tenantId, {
      q,
      web,
      hasWebshop,
      scope,
      maxRows: ACCESSORY_EXPORT_MAX_ROWS
    })

    // Kép-fájlnevek nélkül (gyors): üres Kep = importnál „nem változik”.
    const buffer = await buildAccessoriesWorkbook(
      rows.map((r) => ({
        id: r.id,
        manufacturerName: r.manufacturer_name === '—' ? '' : r.manufacturer_name,
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
        imageFilename: null,
        gallery: []
      })),
      lists,
      { template: false }
    )
    const suffix = scope === 'hits' ? 'talalat' : truncated ? 'reszlet' : 'osszes'
    return xlsx(buffer, `termekek_${suffix}_${date}.xlsx`)
  } catch (err) {
    if (err instanceof AccessoryExportTooLargeError || err instanceof AccessoryExportNeedsFilterError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('accessories export', err)
    const message =
      err instanceof Error && err.message && !err.message.startsWith('Nem sikerült')
        ? err.message
        : 'A letöltés nem sikerült. Próbáld újra.'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
