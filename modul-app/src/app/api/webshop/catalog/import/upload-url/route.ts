import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { SHOP_IMPORT_MAX_BYTES } from '@/lib/webshop/excel/columns'
import { BULK_NOT_READY } from '@/lib/webshop/excel/apply'
import { guardWrite, jsonError, readJson, serverError } from '@/lib/webshop/excel/route-helpers'
import { IMPORT_BUCKET, uploadPathFor } from '@/lib/webshop/excel/source'

const schema = z.object({ name: z.string().min(1).max(200), size: z.number().int().positive() })

/** Aláírt feltöltési URL: a fájl a böngészőből közvetlenül a Storage-ba megy (Vercel 4,5 MB-os korlát nélkül). */
export async function POST(request: NextRequest) {
  try {
    const guard = await guardWrite()
    if (!guard.ok) return guard.response
    const body = await readJson(request, schema)
    if (!body.ok) return body.response
    const { name, size } = body.data
    const lower = name.toLowerCase()
    if (lower.endsWith('.xls')) return jsonError('Ez régi .xls fájl. Nyisd meg Excelben, és mentsd el .xlsx formátumban.')
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.csv')) return jsonError('Csak .xlsx vagy .csv fájl tölthető fel.')
    if (size > SHOP_IMPORT_MAX_BYTES) {
      return jsonError(`A fájl túl nagy (legfeljebb ${Math.round(SHOP_IMPORT_MAX_BYTES / 1024 / 1024)} MB). Bontsd több fájlra.`)
    }
    const path = uploadPathFor(guard.tenantId, name)
    const { data, error } = await guard.supabase.storage.from(IMPORT_BUCKET).createSignedUploadUrl(path)
    if (error || !data) {
      console.error('webshop import upload url', error?.message)
      return jsonError(error?.message?.toLowerCase().includes('bucket') ? BULK_NOT_READY : 'A feltöltés nem indult el. Próbáld újra.', 500)
    }
    return NextResponse.json({ path: data.path, token: data.token })
  } catch (err) {
    return serverError('webshop import upload url', err, 'A feltöltés nem indult el. Próbáld újra.')
  }
}
