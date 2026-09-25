import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'

import type { ShopXWorkbook } from '@/lib/webshop/excel/read'
import { readStoredWorkbook } from '@/lib/webshop/excel/source'
import { SHOP_X_SHEETS, type ShopXDecisions, type ShopXProblem, type ShopXSheet, type ShopXSource } from '@/lib/webshop/excel/types'

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

type Guard =
  | { ok: true; supabase: SupabaseClient; tenantId: string }
  | { ok: false; response: NextResponse }

const fail = (error: string, status: number): Guard => ({
  ok: false,
  response: NextResponse.json({ error }, { status })
})

export function jsonError(error: string, status = 400): NextResponse {
  return NextResponse.json({ error }, { status })
}

export async function guardRead(): Promise<Guard> {
  const user = await getSessionUser()
  if (!user?.tenantId || !user.hasMembership) return fail('Nincs bejelentkezve.', 401)
  if (user.isDevSession) return fail('Dev bypass módban nincs adatbázis.', 400)
  const supabase = await createClient()
  if (!supabase) return fail('Az adatbázis kapcsolat nem elérhető.', 500)
  if (!(await tenantHasWebshop(supabase, user.tenantId))) {
    return fail('Az Online bolt modul nincs bekapcsolva ennél a cégnél.', 403)
  }
  return { ok: true, supabase, tenantId: user.tenantId }
}

export async function guardWrite(): Promise<Guard> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return fail(ctx.message, 403)
  const tenantId = ctx.user.tenantId!
  if (!(await tenantHasWebshop(ctx.supabase, tenantId))) {
    return fail('Az Online bolt modul nincs bekapcsolva ennél a cégnél.', 403)
  }
  return { ok: true, supabase: ctx.supabase, tenantId }
}

const decisionSchema = z.union([
  z.enum(['suggestion', 'create']),
  z.custom<`use:${string}`>((v) => typeof v === 'string' && /^use:[0-9a-f-]{36}$/i.test(v))
])

export const decisionsSchema = z.record(z.string().max(400), decisionSchema).catch({})

export const sourceSchema = z.object({
  kind: z.literal('storage'),
  path: z.string().min(1).max(400),
  name: z.string().min(1).max(200)
})

export const problemsSchema = z
  .array(
    z.object({
      sheet: z.enum(SHOP_X_SHEETS as [ShopXSheet, ...ShopXSheet[]]),
      rowNumber: z.number().int().positive(),
      messages: z.array(z.string().max(2000)).max(40)
    })
  )
  .max(100000)

export async function readJson<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }> {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return { ok: false, response: jsonError('Hibás kérés. Töltsd újra az oldalt.') }
  return { ok: true, data: parsed.data }
}

export async function loadSource(
  supabase: SupabaseClient,
  tenantId: string,
  source: ShopXSource
): Promise<{ ok: true; workbook: ShopXWorkbook } | { ok: false; response: NextResponse }> {
  if (source.kind !== 'storage') return { ok: false, response: jsonError('Töltsd fel újra a fájlt.') }
  const read = await readStoredWorkbook(supabase, tenantId, source.path, source.name)
  if (!read.ok) return { ok: false, response: jsonError(read.message) }
  return { ok: true, workbook: read.workbook }
}

export type ImportBody = { source: ShopXSource; decisions: ShopXDecisions }

export const importBodySchema = z.object({ source: sourceSchema, decisions: decisionsSchema.optional() })

export function problemsFrom(value: unknown): ShopXProblem[] | null {
  const parsed = problemsSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function xlsxResponse(buffer: Buffer, filename: string): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': XLSX_TYPE,
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  })
}

export function serverError(context: string, err: unknown, message: string): NextResponse {
  console.error(context, err)
  return NextResponse.json({ error: message }, { status: 500 })
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}
