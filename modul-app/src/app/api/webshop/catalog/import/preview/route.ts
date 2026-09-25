import { NextRequest, NextResponse } from 'next/server'

import { planShopImport } from '@/lib/webshop/excel/apply'
import {
  guardWrite,
  importBodySchema,
  loadSource,
  readJson,
  serverError
} from '@/lib/webshop/excel/route-helpers'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const guard = await guardWrite()
    if (!guard.ok) return guard.response
    const body = await readJson(request, importBodySchema)
    if (!body.ok) return body.response
    const source = await loadSource(guard.supabase, guard.tenantId, body.data.source)
    if (!source.ok) return source.response
    const { plan } = await planShopImport(guard.supabase, guard.tenantId, source.workbook, body.data.decisions ?? {})
    return NextResponse.json(plan.preview)
  } catch (err) {
    return serverError('webshop catalog import preview', err, 'Az előnézet nem sikerült. Próbáld újra.')
  }
}
