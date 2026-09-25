import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { undoSourceFor } from '@/lib/webshop/excel/apply'
import { guardWrite, jsonError, readJson, serverError } from '@/lib/webshop/excel/route-helpers'

const schema = z.object({ runId: z.string().uuid() })

/** Visszavonás forrása (a mentés előtti állapot). A kliens ezzel indít egy visszaállító mentést. */
export async function POST(request: NextRequest) {
  try {
    const guard = await guardWrite()
    if (!guard.ok) return guard.response
    const body = await readJson(request, schema)
    if (!body.ok) return body.response
    const result = await undoSourceFor(guard.supabase, guard.tenantId, body.data.runId)
    if (!result.ok) return jsonError(result.message, 409)
    return NextResponse.json({ source: result.source })
  } catch (err) {
    return serverError('webshop catalog import undo', err, 'A visszavonás nem indult el.')
  }
}
