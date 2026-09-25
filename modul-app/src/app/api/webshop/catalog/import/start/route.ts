import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prepareShopImport } from '@/lib/webshop/excel/apply'
import {
  guardWrite,
  importBodySchema,
  jsonError,
  loadSource,
  readJson,
  serverError
} from '@/lib/webshop/excel/route-helpers'

export const maxDuration = 300

const schema = importBodySchema.extend({ restoresRunId: z.string().uuid().nullish() })

/** Mentés első lépése: katalógus létrehozása, mentés előtti állapot, futás rekord. */
export async function POST(request: NextRequest) {
  try {
    const guard = await guardWrite()
    if (!guard.ok) return guard.response
    const body = await readJson(request, schema)
    if (!body.ok) return body.response
    const source = await loadSource(guard.supabase, guard.tenantId, body.data.source)
    if (!source.ok) return source.response
    const result = await prepareShopImport(
      guard.supabase,
      guard.tenantId,
      source.workbook,
      body.data.decisions ?? {},
      body.data.source,
      { restoresRunId: body.data.restoresRunId ?? null }
    )
    if (!result.ok) return jsonError(result.message, 409)
    return NextResponse.json(result)
  } catch (err) {
    return serverError('webshop catalog import start', err, 'A mentés nem indult el. Semmi nem változott — próbáld újra.')
  }
}
