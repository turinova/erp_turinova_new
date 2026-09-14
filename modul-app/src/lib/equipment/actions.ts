'use server'

import { revalidatePath } from 'next/cache'

import { equipmentFormSchema } from '@/lib/equipment/parse'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type EquipmentActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const BERENDEZES_PATH = '/torzsadatok/rendszer/berendezes'

function revalidateEquipmentPaths() {
  revalidatePath(BERENDEZES_PATH)
  revalidatePath('/ajanlatok', 'layout')
  revalidatePath('/torzsadatok/alapanyagok/tablas-anyagok', 'layout')
  revalidatePath('/torzsadatok/alapanyagok/elzarok', 'layout')
  revalidatePath('/opti')
}

function mapUniqueNameError(message: string): string | null {
  if (
    message.includes('equipment_tenant_name_alive') ||
    message.includes('duplicate key')
  ) {
    return 'Már van ilyen nevű berendezés ebben a cégben.'
  }
  return null
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

export async function createEquipment(input: {
  name: string
  exportFormat: string
}): Promise<EquipmentActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = equipmentFormSchema.safeParse({
    name: input.name,
    exportFormat: input.exportFormat
  })
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const { error } = await ctx.supabase.from('equipment').insert({
    tenant_id: ctx.user.tenantId!,
    name: parsed.data.name,
    export_format: parsed.data.exportFormat
  })

  if (error) {
    const unique = mapUniqueNameError(error.message)
    return {
      ok: false,
      message: unique ?? 'Nem sikerült létrehozni a berendezést.',
      fieldErrors: unique ? { name: unique } : undefined
    }
  }

  revalidateEquipmentPaths()
  return { ok: true }
}

export async function updateEquipment(input: {
  id: string
  name: string
  exportFormat: string
}): Promise<EquipmentActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = equipmentFormSchema.safeParse({
    name: input.name,
    exportFormat: input.exportFormat
  })
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const { data, error } = await ctx.supabase
    .from('equipment')
    .update({
      name: parsed.data.name,
      export_format: parsed.data.exportFormat,
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
      message: unique ?? 'Nem sikerült menteni a berendezést.',
      fieldErrors: unique ? { name: unique } : undefined
    }
  }

  if (!data) {
    return { ok: false, message: 'A berendezés nem található.' }
  }

  revalidateEquipmentPaths()
  return { ok: true }
}

export async function softDeleteEquipment(
  id: string
): Promise<EquipmentActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!

  const [{ count: sheetCount }, { count: edgeCount }] = await Promise.all([
    ctx.supabase
      .from('sheet_materials')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('equipment_id', id)
      .is('deleted_at', null),
    ctx.supabase
      .from('edge_materials')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('equipment_id', id)
      .is('deleted_at', null)
  ])

  const sheets = sheetCount ?? 0
  const edges = edgeCount ?? 0
  if (sheets > 0 || edges > 0) {
    const parts: string[] = []
    if (sheets > 0) parts.push(`${sheets} táblás anyag`)
    if (edges > 0) parts.push(`${edges} élzáró`)
    return {
      ok: false,
      message: `Nem törölhető: ${parts.join(' és ')} használja. Előbb kösd át más berendezésre.`
    }
  }

  const { data, error } = await ctx.supabase
    .from('equipment')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    return { ok: false, message: 'Nem sikerült törölni a berendezést.' }
  }

  if (!data) {
    return { ok: false, message: 'A berendezés nem található.' }
  }

  revalidateEquipmentPaths()
  return { ok: true }
}
