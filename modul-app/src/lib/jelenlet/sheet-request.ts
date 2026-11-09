import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { getSessionUser } from '@/lib/auth/session'
import { sheetRulesSchema, type SheetRules } from '@/lib/jelenlet/sheet-rules'
import { createClient } from '@/lib/supabase/server'

export const SHEET_MAX_EMPLOYEES = 100

const sheetRequestSchema = z.object({
  employeeIds: z
    .array(z.string().uuid())
    .min(1, 'Nincs kiválasztott dolgozó.')
    .max(SHEET_MAX_EMPLOYEES, `Túl sok dolgozó (max. ${SHEET_MAX_EMPLOYEES}).`),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  rules: sheetRulesSchema,
  presetName: z.string().trim().max(80).optional().default('Egyedi'),
  output: z.enum(['zip', 'merged']).optional().default('zip'),
  previewEmployeeId: z.string().uuid().optional().nullable()
})

export type SheetRequest = z.infer<typeof sheetRequestSchema> & { rules: SheetRules }

export type SheetRequestContext =
  | {
      ok: true
      tenantId: string
      supabase: SupabaseClient
      body: SheetRequest
    }
  | { ok: false; status: number; error: string }

export async function parseSheetRequest(request: Request): Promise<SheetRequestContext> {
  const user = await getSessionUser()
  if (!user?.tenantId || !user.hasMembership || user.isDevSession) {
    return { ok: false, status: 401, error: 'Nincs bejelentkezett cég.' }
  }

  const raw = await request.json().catch(() => null)
  const parsed = sheetRequestSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: parsed.error.issues[0]?.message ?? 'Érvénytelen kérés.'
    }
  }

  const supabase = await createClient()
  if (!supabase) {
    return { ok: false, status: 500, error: 'Az adatbázis kapcsolat nem elérhető.' }
  }

  return { ok: true, tenantId: user.tenantId, supabase, body: parsed.data }
}
