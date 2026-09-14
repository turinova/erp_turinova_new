'use server'

import { revalidatePath } from 'next/cache'

import {
  parseDecimalInput,
  parseIntegerInput,
  sheetMaterialFormSchema,
  type SheetMaterialFormValues
} from '@/lib/sheet-materials/parse'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type SheetMaterialActionResult =
  | { ok: true; id: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const LIST_PATH = '/torzsadatok/alapanyagok/tablas-anyagok'

function revalidateSheetPaths(id?: string) {
  revalidatePath(LIST_PATH)
  if (id) revalidatePath(`${LIST_PATH}/${id}`)
  revalidatePath(`${LIST_PATH}/uj`)
  revalidatePath('/ajanlatok', 'layout')
  revalidatePath('/opti')
}

function mapDbError(message: string): string | null {
  if (
    message.includes('sheet_materials_identity_alive') ||
    message.includes('duplicate key')
  ) {
    return 'Már van ilyen táblás anyag (gyártó + név + méretek).'
  }
  if (message.includes('manufacturer_id')) {
    return 'A választott gyártó érvénytelen.'
  }
  if (message.includes('tax_rate_id')) {
    return 'A választott adónem érvénytelen.'
  }
  if (message.includes('equipment_id')) {
    return 'A választott berendezés érvénytelen.'
  }
  return null
}

export type SheetFormInput = {
  manufacturerId: string
  taxRateId: string
  equipmentId: string
  name: string
  lengthMmRaw: string
  widthMmRaw: string
  thicknessMmRaw: string
  onStock: boolean
  active: boolean
  imageUrl: string | null
  trimTopMmRaw: string
  trimRightMmRaw: string
  trimBottomMmRaw: string
  trimLeftMmRaw: string
  kerfMmRaw: string
  wasteMultiRaw: string
  usageLimitPercentRaw: string
  grainDirection: boolean
  rotatable: boolean
  priceNet: number
  machineCode: string
}

function parseFormInput(input: SheetFormInput) {
  const usagePercent = parseDecimalInput(input.usageLimitPercentRaw)
  const usageLimit = usagePercent === null ? null : usagePercent / 100
  const imageRaw = (input.imageUrl ?? '').trim()

  return sheetMaterialFormSchema.safeParse({
    manufacturerId: input.manufacturerId,
    taxRateId: input.taxRateId,
    equipmentId: input.equipmentId,
    name: input.name,
    lengthMm: parseIntegerInput(input.lengthMmRaw),
    widthMm: parseIntegerInput(input.widthMmRaw),
    thicknessMm: parseDecimalInput(input.thicknessMmRaw),
    onStock: input.onStock,
    active: input.active,
    imageUrl: imageRaw === '' ? null : imageRaw,
    trimTopMm: parseIntegerInput(input.trimTopMmRaw),
    trimRightMm: parseIntegerInput(input.trimRightMmRaw),
    trimBottomMm: parseIntegerInput(input.trimBottomMmRaw),
    trimLeftMm: parseIntegerInput(input.trimLeftMmRaw),
    kerfMm: parseIntegerInput(input.kerfMmRaw),
    wasteMulti: parseDecimalInput(input.wasteMultiRaw),
    usageLimit,
    grainDirection: input.grainDirection,
    rotatable: input.rotatable,
    priceNet: input.priceNet,
    machineCode: input.machineCode
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

function rowFromParsed(data: SheetMaterialFormValues) {
  return {
    manufacturer_id: data.manufacturerId,
    tax_rate_id: data.taxRateId,
    equipment_id: data.equipmentId,
    name: data.name,
    length_mm: data.lengthMm,
    width_mm: data.widthMm,
    thickness_mm: data.thicknessMm,
    on_stock: data.onStock,
    active: data.active,
    image_url: data.imageUrl,
    trim_top_mm: data.trimTopMm,
    trim_right_mm: data.trimRightMm,
    trim_bottom_mm: data.trimBottomMm,
    trim_left_mm: data.trimLeftMm,
    kerf_mm: data.kerfMm,
    waste_multi: data.wasteMulti,
    usage_limit: data.usageLimit,
    grain_direction: data.grainDirection,
    rotatable: data.rotatable,
    price_net: data.priceNet,
    machine_code: data.machineCode
  }
}

export async function createSheetMaterial(
  input: SheetFormInput
): Promise<SheetMaterialActionResult> {
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
    .from('sheet_materials')
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
      message: mapped ?? 'Nem sikerült létrehozni a táblás anyagot.'
    }
  }

  revalidateSheetPaths(data.id)
  if (ctx.user.tenantId) {
    const { markOnboardingFlag } = await import(
      '@/lib/platform/onboarding-flags'
    )
    await markOnboardingFlag(ctx.user.tenantId, { has_sheet_material: true })
  }
  return { ok: true, id: data.id }
}

export async function updateSheetMaterial(
  input: SheetFormInput & { id: string }
): Promise<SheetMaterialActionResult> {
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
    .from('sheet_materials')
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
      message: mapped ?? 'Nem sikerült menteni a táblás anyagot.'
    }
  }

  if (!data) {
    return { ok: false, message: 'A táblás anyag nem található.' }
  }

  revalidateSheetPaths(data.id)
  return { ok: true, id: data.id }
}

export async function softDeleteSheetMaterial(
  id: string
): Promise<SheetMaterialActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data, error } = await ctx.supabase
    .from('sheet_materials')
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
    return { ok: false, message: 'Nem sikerült törölni a táblás anyagot.' }
  }

  if (!data) {
    return { ok: false, message: 'A táblás anyag nem található.' }
  }

  revalidateSheetPaths(data.id)
  return { ok: true, id: data.id }
}
