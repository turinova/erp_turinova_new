import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { ACCESSORY_IMPORT_MAX_BYTES } from '@/lib/accessories/excel-columns'
import { parseAccessoriesWorkbook, type ParsedAccessoryWorkbook } from '@/lib/accessories/excel-workbook'
import { loadAccessoryImportContext } from '@/lib/accessories/import-context'
import { planAccessoryImport, type AccessoryImportPlan } from '@/lib/accessories/import-plan'
import type { AccessoryImportDecisions, AccessoryImportFailure } from '@/lib/accessories/import-types'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const decisionsSchema = z.record(z.string().max(400), z.enum(['suggestion', 'create'])).catch({})

const failedSchema = z
  .array(z.object({ rowNumber: z.number().int().positive(), message: z.string().max(500) }))
  .max(20000)
  .catch([])

function parseJson(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== 'string' || !raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

const fail = (error: string, status: number) => ({
  ok: false as const,
  response: NextResponse.json({ error }, { status })
})

export type PlannedUpload = {
  supabase: SupabaseClient
  tenantId: string
  workbook: ParsedAccessoryWorkbook
  plan: AccessoryImportPlan
  form: FormData
}

/** Jogosultság → fájl → a mostani adatbázis-állapot → terv. Minden import-útvonal ezzel kezd. */
export async function planUpload(
  request: Request
): Promise<{ ok: true; value: PlannedUpload } | { ok: false; response: NextResponse }> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return fail(ctx.message, 403)
  const tenantId = ctx.user.tenantId!

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return fail('Hiányzik az Excel fájl.', 400)
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.xls') || lower.endsWith('.csv')) {
    return fail('Ezt a formátumot nem tudjuk olvasni. Excelben: Fájl → Mentés másként → Excel-munkafüzet (.xlsx).', 400)
  }
  if (!lower.endsWith('.xlsx')) return fail('Csak .xlsx fájl tölthető fel.', 400)
  if (file.size > ACCESSORY_IMPORT_MAX_BYTES) {
    return fail('A fájl nagyobb 4 MB-nál. Oszd két fájlra, vagy töröld belőle a képeket és a felesleges lapokat.', 400)
  }

  const parsed = await parseAccessoriesWorkbook(Buffer.from(await file.arrayBuffer()))
  if (!parsed.ok) return fail(parsed.message, 400)

  const loaded = await loadAccessoryImportContext(ctx.supabase, tenantId)
  if (!loaded.ok) return fail(loaded.message, 500)

  const decisions: AccessoryImportDecisions = decisionsSchema.parse(parseJson(form.get('decisions')) ?? {})
  return {
    ok: true,
    value: {
      supabase: ctx.supabase,
      tenantId,
      workbook: parsed.workbook,
      plan: planAccessoryImport(loaded.ctx, parsed.workbook, decisions),
      form
    }
  }
}

export function parseFailed(form: FormData): AccessoryImportFailure[] {
  return failedSchema.parse(parseJson(form.get('failed')) ?? [])
}

export function serverError(context: string, err: unknown, message: string): NextResponse {
  console.error(context, err)
  return NextResponse.json({ error: message }, { status: 500 })
}
