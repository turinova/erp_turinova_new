import { NextRequest } from 'next/server'

import { SHOP_OPTIONAL_SHEETS, type ShopOptionalSheet } from '@/lib/webshop/excel/columns'
import { loadShopXContext } from '@/lib/webshop/excel/context'
import { guardRead, serverError, today, xlsxResponse } from '@/lib/webshop/excel/route-helpers'
import { buildShopWorkbook, type ShopExportMode } from '@/lib/webshop/excel/write'
import {
  listShopCatalogIds,
  SHOP_CATALOG_FILTERS,
  type ShopCatalogFilter
} from '@/lib/webshop/product-queries'

export const maxDuration = 120

const MODES: ShopExportMode[] = ['simple', 'full', 'template']

function parseSheets(raw: string | null): ShopOptionalSheet[] | undefined {
  if (raw == null) return undefined
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is ShopOptionalSheet => (SHOP_OPTIONAL_SHEETS as readonly string[]).includes(s))
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const mode = (MODES as string[]).includes(sp.get('mode') ?? '') ? (sp.get('mode') as ShopExportMode) : 'simple'
    const filter = (SHOP_CATALOG_FILTERS as readonly string[]).includes(sp.get('filter') ?? '')
      ? (sp.get('filter') as ShopCatalogFilter)
      : 'all'
    const q = (sp.get('q') ?? '').slice(0, 80)
    const sheets = parseSheets(sp.get('sheets'))

    const guard = await guardRead()
    if (!guard.ok) return guard.response

    const [ctx, ids] = await Promise.all([
      loadShopXContext(guard.supabase, guard.tenantId),
      mode === 'template' ? Promise.resolve([] as string[]) : listShopCatalogIds(guard.supabase, guard.tenantId, { filter, q })
    ])
    const products = ids.map((id) => ctx.byId.get(id)).filter((p) => p != null)
    const buffer = await buildShopWorkbook(ctx, products, mode, { sheets })
    const name = mode === 'template' ? 'bolt_sablon.xlsx' : `bolt_${mode === 'simple' ? 'egyszeru' : 'teljes'}_${today()}.xlsx`
    return xlsxResponse(buffer, name)
  } catch (err) {
    return serverError('webshop catalog export', err, 'A letöltés nem sikerült. Próbáld újra.')
  }
}
