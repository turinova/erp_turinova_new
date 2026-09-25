import { NextRequest } from 'next/server'

import { planShopImport } from '@/lib/webshop/excel/apply'
import {
  guardWrite,
  importBodySchema,
  jsonError,
  loadSource,
  readJson,
  serverError,
  today,
  xlsxResponse
} from '@/lib/webshop/excel/route-helpers'
import { buildShopWorkbook } from '@/lib/webshop/excel/write'

export const maxDuration = 120

/** A változó termékek mostani állapota (visszatölthető pillanatkép) — mentés előtt kézi másolatnak. */
export async function POST(request: NextRequest) {
  try {
    const guard = await guardWrite()
    if (!guard.ok) return guard.response
    const body = await readJson(request, importBodySchema)
    if (!body.ok) return body.response
    const source = await loadSource(guard.supabase, guard.tenantId, body.data.source)
    if (!source.ok) return source.response
    const { plan, ctx } = await planShopImport(guard.supabase, guard.tenantId, source.workbook, body.data.decisions ?? {})
    const ids = new Set<string>()
    for (const w of plan.writes) {
      ids.add(w.accessoryId)
      for (const id of [...w.altAdd, ...w.altRemove]) ids.add(id)
    }
    if (ids.size === 0) return jsonError('Nincs változó termék.')
    const products = [...ids].map((id) => ctx.byId.get(id)).filter((p) => p != null)
    const buffer = await buildShopWorkbook(ctx, products, 'snapshot')
    return xlsxResponse(buffer, `bolt_mentes_elotti_allapot_${today()}.xlsx`)
  } catch (err) {
    return serverError('webshop catalog backup', err, 'A mostani állapot letöltése nem sikerült.')
  }
}
