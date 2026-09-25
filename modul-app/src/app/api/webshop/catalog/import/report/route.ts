import { NextRequest } from 'next/server'

import { planShopImport } from '@/lib/webshop/excel/apply'
import {
  guardWrite,
  importBodySchema,
  loadSource,
  readJson,
  serverError,
  today,
  xlsxResponse
} from '@/lib/webshop/excel/route-helpers'
import { buildReportWorkbook } from '@/lib/webshop/excel/write'

export const maxDuration = 120

/** Teljes jelentés az előnézetről (minden tétel, nem csak az első néhány száz). */
export async function POST(request: NextRequest) {
  try {
    const guard = await guardWrite()
    if (!guard.ok) return guard.response
    const body = await readJson(request, importBodySchema)
    if (!body.ok) return body.response
    const source = await loadSource(guard.supabase, guard.tenantId, body.data.source)
    if (!source.ok) return source.response
    const { plan } = await planShopImport(guard.supabase, guard.tenantId, source.workbook, body.data.decisions ?? {})
    return xlsxResponse(await buildReportWorkbook(plan.items), `bolt_import_jelentes_${today()}.xlsx`)
  } catch (err) {
    return serverError('webshop catalog import report', err, 'A jelentés letöltése nem sikerült.')
  }
}
