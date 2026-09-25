'use server'

import { revalidatePath } from 'next/cache'

import {
  manufacturerFormSchema,
  type ManufacturerFormInput,
  type ManufacturerFormValues
} from '@/lib/manufacturers/parse'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type ManufacturerActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const GYARTOK_PATH = '/torzsadatok/rendszer/gyartok'

function mapUniqueNameError(message: string): string | null {
  if (
    message.includes('manufacturers_tenant_name_alive') ||
    message.includes('duplicate key')
  ) {
    return 'Már van ilyen nevű gyártó ebben a cégben.'
  }
  return null
}

type ParseResult =
  | { ok: true; data: ManufacturerFormValues }
  | { ok: false; result: ManufacturerActionResult }

function parseInput(input: ManufacturerFormInput): ParseResult {
  const parsed = manufacturerFormSchema.safeParse(input)
  if (parsed.success) return { ok: true, data: parsed.data }
  const fieldErrors: Record<string, string> = {}
  for (const issue of parsed.error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !fieldErrors[key]) {
      fieldErrors[key] = issue.message
    }
  }
  return {
    ok: false,
    result: { ok: false, message: 'Ellenőrizd a megadott adatokat.', fieldErrors }
  }
}

function toRow(d: ManufacturerFormValues) {
  return {
    name: d.name,
    legal_name: d.legalName,
    postal_address: d.postalAddress,
    email: d.email,
    website: d.website,
    eu_rep_name: d.euRepName,
    eu_rep_address: d.euRepAddress,
    eu_rep_email: d.euRepEmail
  }
}

export async function createManufacturer(
  input: ManufacturerFormInput
): Promise<ManufacturerActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = parseInput(input)
  if (!parsed.ok) return parsed.result

  const { error } = await ctx.supabase.from('manufacturers').insert({
    tenant_id: ctx.user.tenantId!,
    ...toRow(parsed.data)
  })

  if (error) {
    const unique = mapUniqueNameError(error.message)
    return {
      ok: false,
      message: unique ?? 'Nem sikerült létrehozni a gyártót.',
      fieldErrors: unique ? { name: unique } : undefined
    }
  }

  revalidatePath(GYARTOK_PATH)
  return { ok: true }
}

export async function updateManufacturer(
  input: ManufacturerFormInput & { id: string }
): Promise<ManufacturerActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = parseInput(input)
  if (!parsed.ok) return parsed.result

  const { data, error } = await ctx.supabase
    .from('manufacturers')
    .update({
      ...toRow(parsed.data),
      updated_at: new Date().toISOString()
    })
    .eq('id', input.id)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    const unique = mapUniqueNameError(error.message)
    return {
      ok: false,
      message: unique ?? 'Nem sikerült menteni a gyártót.',
      fieldErrors: unique ? { name: unique } : undefined
    }
  }

  if (!data) {
    return { ok: false, message: 'A gyártó nem található.' }
  }

  revalidatePath(GYARTOK_PATH)
  return { ok: true }
}

export async function softDeleteManufacturer(
  id: string
): Promise<ManufacturerActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data, error } = await ctx.supabase
    .from('manufacturers')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    return { ok: false, message: 'Nem sikerült törölni a gyártót.' }
  }

  if (!data) {
    return { ok: false, message: 'A gyártó nem található.' }
  }

  revalidatePath(GYARTOK_PATH)
  return { ok: true }
}
