'use server'

import { revalidatePath } from 'next/cache'

import {
  edgeMaterialFormSchema,
  parseDecimalInput,
  parseIntegerInput
} from '@/lib/edge-materials/parse'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type EdgeMaterialActionResult =
  | { ok: true; id: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const LIST_PATH = '/torzsadatok/alapanyagok/elzarok'

function revalidateEdgePaths(id?: string) {
  revalidatePath(LIST_PATH)
  if (id) revalidatePath(`${LIST_PATH}/${id}`)
  revalidatePath(`${LIST_PATH}/uj`)
  revalidatePath('/ajanlatok', 'layout')
  revalidatePath('/opti')
}

function mapDbError(message: string): string | null {
  if (
    message.includes('edge_materials_identity_alive') ||
    message.includes('duplicate key')
  ) {
    return 'Már van ilyen élzáró (gyártó + típus + dekor + méretek).'
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

type EdgeFormInput = {
  manufacturerId: string
  taxRateId: string
  equipmentId: string
  type: string
  decor: string
  widthMmRaw: string
  thicknessMmRaw: string
  priceNet: number
  allowanceMmRaw: string
  favouritePriorityRaw: string
  active: boolean
  machineCode: string
}

function parseFormInput(input: EdgeFormInput) {
  const favouriteRaw = input.favouritePriorityRaw.trim()
  const favouritePriority =
    favouriteRaw === '' ? null : parseIntegerInput(favouriteRaw)

  return edgeMaterialFormSchema.safeParse({
    manufacturerId: input.manufacturerId,
    taxRateId: input.taxRateId,
    equipmentId: input.equipmentId,
    type: input.type,
    decor: input.decor,
    widthMm: parseDecimalInput(input.widthMmRaw),
    thicknessMm: parseDecimalInput(input.thicknessMmRaw),
    priceNet: input.priceNet,
    allowanceMm: parseIntegerInput(input.allowanceMmRaw),
    favouritePriority,
    active: input.active,
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

export async function createEdgeMaterial(
  input: EdgeFormInput
): Promise<EdgeMaterialActionResult> {
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
    .from('edge_materials')
    .insert({
      tenant_id: ctx.user.tenantId!,
      manufacturer_id: parsed.data.manufacturerId,
      tax_rate_id: parsed.data.taxRateId,
      equipment_id: parsed.data.equipmentId,
      type: parsed.data.type,
      decor: parsed.data.decor,
      width_mm: parsed.data.widthMm,
      thickness_mm: parsed.data.thicknessMm,
      price_net: parsed.data.priceNet,
      allowance_mm: parsed.data.allowanceMm,
      favourite_priority: parsed.data.favouritePriority,
      active: parsed.data.active,
      machine_code: parsed.data.machineCode
    })
    .select('id')
    .single()

  if (error || !data) {
    const mapped = error ? mapDbError(error.message) : null
    return {
      ok: false,
      message: mapped ?? 'Nem sikerült létrehozni az élzárót.'
    }
  }

  revalidateEdgePaths(data.id)
  if (ctx.user.tenantId) {
    const { markOnboardingFlag } = await import(
      '@/lib/platform/onboarding-flags'
    )
    await markOnboardingFlag(ctx.user.tenantId, { has_edge_material: true })
  }
  return { ok: true, id: data.id }
}

export async function updateEdgeMaterial(
  input: EdgeFormInput & { id: string }
): Promise<EdgeMaterialActionResult> {
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
    .from('edge_materials')
    .update({
      manufacturer_id: parsed.data.manufacturerId,
      tax_rate_id: parsed.data.taxRateId,
      equipment_id: parsed.data.equipmentId,
      type: parsed.data.type,
      decor: parsed.data.decor,
      width_mm: parsed.data.widthMm,
      thickness_mm: parsed.data.thicknessMm,
      price_net: parsed.data.priceNet,
      allowance_mm: parsed.data.allowanceMm,
      favourite_priority: parsed.data.favouritePriority,
      active: parsed.data.active,
      machine_code: parsed.data.machineCode,
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
      message: mapped ?? 'Nem sikerült menteni az élzárót.'
    }
  }

  if (!data) {
    return { ok: false, message: 'Az élzáró nem található.' }
  }

  revalidateEdgePaths(data.id)
  return { ok: true, id: data.id }
}

export async function softDeleteEdgeMaterial(
  id: string
): Promise<EdgeMaterialActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data, error } = await ctx.supabase
    .from('edge_materials')
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
    return { ok: false, message: 'Nem sikerült törölni az élzárót.' }
  }

  if (!data) {
    return { ok: false, message: 'Az élzáró nem található.' }
  }

  revalidateEdgePaths(data.id)
  return { ok: true, id: data.id }
}
