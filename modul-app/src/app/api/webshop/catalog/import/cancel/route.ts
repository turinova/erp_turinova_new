import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { failShopImport } from '@/lib/webshop/excel/apply'
import { guardWrite, readJson, serverError } from '@/lib/webshop/excel/route-helpers'

const schema = z.object({ runId: z.string().uuid() })

/** Félbehagyott mentés lezárása: a zár feloldódik, a már mentett rész marad (visszavonható). */
export async function POST(request: NextRequest) {
  try {
    const guard = await guardWrite()
    if (!guard.ok) return guard.response
    const body = await readJson(request, schema)
    if (!body.ok) return body.response
    await failShopImport(guard.supabase, guard.tenantId, body.data.runId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return serverError('webshop catalog import cancel', err, 'Nem sikerült lezárni a mentést.')
  }
}
