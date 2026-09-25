import { NextRequest } from 'next/server'
import { z } from 'zod'

import {
  guardWrite,
  jsonError,
  loadSource,
  problemsSchema,
  readJson,
  serverError,
  sourceSchema,
  today,
  xlsxResponse
} from '@/lib/webshop/excel/route-helpers'
import { buildProblemsWorkbook } from '@/lib/webshop/excel/write'

export const maxDuration = 120

const schema = z.object({ source: sourceSchema, problems: problemsSchema })

export async function POST(request: NextRequest) {
  try {
    const guard = await guardWrite()
    if (!guard.ok) return guard.response
    const body = await readJson(request, schema)
    if (!body.ok) return body.response
    if (body.data.problems.length === 0) return jsonError('Nincs hibás sor.')
    const source = await loadSource(guard.supabase, guard.tenantId, body.data.source)
    if (!source.ok) return source.response
    const buffer = await buildProblemsWorkbook(source.workbook, body.data.problems)
    return xlsxResponse(buffer, `bolt_hibas_sorok_${today()}.xlsx`)
  } catch (err) {
    return serverError('webshop catalog import problems', err, 'A hibás sorok letöltése nem sikerült.')
  }
}
