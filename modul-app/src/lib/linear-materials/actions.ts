'use server'

import { revalidatePath } from 'next/cache'

import {
  linearMaterialFormSchema,
  parseDecimalInput,
  parseIntegerInput,
  type LinearMaterialFormValues
} from '@/lib/linear-materials/parse'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type LinearMaterialActionResult =
  | { ok: true; id: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const LIST_PATH = '/torzsadatok/alapanyagok/szalas-anyagok'

function revalidateLinearPaths(id?: string) {
  revalidatePath(LIST_PATH)
  if (id) revalidatePath(`${LIST_PATH}/${id}`)
  revalidatePath(`${LIST_PATH}/uj`)
}

function mapDbError(message: string): string | null {
  if (
    message.includes('linear_materials_identity_alive') ||
    message.includes('duplicate key')
  ) {
    return 'Már van ilyen szálas anyag (gyártó + típus + név + méretek).'
  }
  if (message.includes('manufacturer_id')) {
    return 'A választott gyártó érvénytelen.'
  }
  if (message.includes('tax_rate_id')) {
    return 'A választott adónem érvénytelen.'
  }
  return null
}

export type LinearFormInput = {
  manufacturerId: string
  taxRateId: string
  name: string
  materialType: string
  lengthMmRaw: string
  widthMmRaw: string
  thicknessMmRaw: string
  onStock: boolean
  active: boolean
  imageUrl: string | null
  priceNet: number
}

function parseFormInput(input: LinearFormInput) {
  const imageRaw = (input.imageUrl ?? '').trim()
  return linearMaterialFormSchema.safeParse({
    manufacturerId: input.manufacturerId,
    taxRateId: input.taxRateId,
    name: input.name,
    materialType: input.materialType,
    lengthMm: parseIntegerInput(input.lengthMmRaw),
    widthMm: parseIntegerInput(input.widthMmRaw),
    thicknessMm: parseDecimalInput(input.thicknessMmRaw),
    onStock: input.onStock,
    active: input.active,
    imageUrl: imageRaw === '' ? null : imageRaw,
    priceNet: input.priceNet
  })
}

function fieldErrorsFromZod(
  issues: { path: (string | number)[]; message: string }[]
) {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !fieldErrors[key]) {
      fieldErrors[key] = issue.message
    }
  }
  return fieldErrors
}

function rowFromParsed(data: LinearMaterialFormValues) {
  return {
    manufacturer_id: data.manufacturerId,
    tax_rate_id: data.taxRateId,
    name: data.name,
    material_type: data.materialType,
    length_mm: data.lengthMm,
    width_mm: data.widthMm,
    thickness_mm: data.thicknessMm,
    on_stock: data.onStock,
    active: data.active,
    image_url: data.imageUrl,
    price_net: data.priceNet
  }
}

export async function createLinearMaterial(
  input: LinearFormInput
): Promise<LinearMaterialActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = parseFormInput(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const { data, error } = await ctx.supabase
    .from('linear_materials')
    .insert({
      tenant_id: ctx.user.tenantId!,
      ...rowFromParsed(parsed.data)
    })
    .select('id')
    .single()

  if (error || !data) {
    const mapped = error ? mapDbError(error.message) : null
    return {
      ok: false,
      message: mapped ?? 'Nem sikerült létrehozni a szálas anyagot.'
    }
  }

  revalidateLinearPaths(data.id)
  return { ok: true, id: data.id }
}

export async function updateLinearMaterial(
  input: LinearFormInput & { id: string }
): Promise<LinearMaterialActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = parseFormInput(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const { data, error } = await ctx.supabase
    .from('linear_materials')
    .update({
      ...rowFromParsed(parsed.data),
      updated_at: new Date().toISOString()
    })
    .eq('id', input.id)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    const mapped = mapDbError(error.message)
    return {
      ok: false,
      message: mapped ?? 'Nem sikerült menteni a szálas anyagot.'
    }
  }

  if (!data) {
    return { ok: false, message: 'A szálas anyag nem található.' }
  }

  revalidateLinearPaths(data.id)
  return { ok: true, id: data.id }
}

export async function softDeleteLinearMaterial(
  id: string
): Promise<LinearMaterialActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data, error } = await ctx.supabase
    .from('linear_materials')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      active: false
    })
    .eq('id', id)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    return { ok: false, message: 'Nem sikerült törölni a szálas anyagot.' }
  }

  if (!data) {
    return { ok: false, message: 'A szálas anyag nem található.' }
  }

  revalidateLinearPaths(data.id)
  return { ok: true, id: data.id }
}
