import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { stepShopImport } from '@/lib/webshop/excel/apply'
import {
  guardWrite,
  importBodySchema,
  jsonError,
  loadSource,
  readJson,
  serverError
} from '@/lib/webshop/excel/route-helpers'

export const maxDuration = 300

const schema = importBodySchema.extend({ runId: z.string().uuid(), cursor: z.number().int().min(0) })

/** Egy mentési lépés (néhány ezer termék). A kliens a `next` értékkel hívja újra, amíg null nem lesz. */
export async function POST(request: NextRequest) {
  try {
    const guard = await guardWrite()
    if (!guard.ok) return guard.response
    const body = await readJson(request, schema)
    if (!body.ok) return body.response
    const source = await loadSource(guard.supabase, guard.tenantId, body.data.source)
    if (!source.ok) return source.response
    const step = await stepShopImport(guard.supabase, guard.tenantId, {
      runId: body.data.runId,
      cursor: body.data.cursor,
      wb: source.workbook,
      decisions: body.data.decisions ?? {}
    })
    if (!step.ok) return jsonError(step.message, 409)
    return NextResponse.json(step.result)
  } catch (err) {
    return serverError(
      'webshop catalog import step',
      err,
      'Ez a lépés nem sikerült. A már mentett rész megmaradt — a „Folytatás” gombbal ugyanonnan mehetsz tovább.'
    )
  }
}
