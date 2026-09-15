'use server'

import { revalidatePath } from 'next/cache'

import { feeTypeFormSchema } from '@/lib/fee-types/parse'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type FeeTypeActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const LIST_PATH = '/torzsadatok/rendszer/dij-tipusok'

function mapDbError(message: string): {
  field?: string
  message: string
} | null {
  if (
    message.includes('fee_types_tenant_name_alive') ||
    (message.includes('duplicate key') && message.includes('name'))
  ) {
    return {
      field: 'name',
      message: 'Már van ilyen nevű díj típus ebben a cégben.'
    }
  }
  if (message.includes('tax_rate_id')) {
    return {
      field: 'taxRateId',
      message: 'A választott adónem érvénytelen.'
    }
  }
  if (message.includes('unit_id')) {
    return {
      field: 'unitId',
      message: 'A választott egység érvénytelen.'
    }
  }
  return null
}

function fieldErrorsFromZod(
  issues: { path: (string | number)[]; message: string }[]
): Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !fieldErrors[key]) {
      fieldErrors[key] = issue.message
    }
  }
  return fieldErrors
}

export type FeeTypeFormInput = {
  name: string
  taxRateId: string
  unitId: string
  priceNet: number
  active: boolean
}

export async function createFeeType(
  input: FeeTypeFormInput
): Promise<FeeTypeActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = feeTypeFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const { error } = await ctx.supabase.from('fee_types').insert({
    tenant_id: ctx.user.tenantId!,
    name: parsed.data.name,
    tax_rate_id: parsed.data.taxRateId,
    unit_id: parsed.data.unitId,
    price_net: parsed.data.priceNet,
    active: parsed.data.active
  })

  if (error) {
    const mapped = mapDbError(error.message)
    return {
      ok: false,
      message: mapped?.message ?? 'Nem sikerült létrehozni a díj típust.',
      fieldErrors:
        mapped?.field != null ? { [mapped.field]: mapped.message } : undefined
    }
  }

  revalidatePath(LIST_PATH)
  return { ok: true }
}

export async function updateFeeType(
  input: FeeTypeFormInput & { id: string }
): Promise<FeeTypeActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = feeTypeFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const { data, error } = await ctx.supabase
    .from('fee_types')
    .update({
      name: parsed.data.name,
      tax_rate_id: parsed.data.taxRateId,
      unit_id: parsed.data.unitId,
      price_net: parsed.data.priceNet,
      active: parsed.data.active,
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
      message: mapped?.message ?? 'Nem sikerült menteni a díj típust.',
      fieldErrors:
        mapped?.field != null ? { [mapped.field]: mapped.message } : undefined
    }
  }

  if (!data) {
    return { ok: false, message: 'A díj típus nem található.' }
  }

  revalidatePath(LIST_PATH)
  return { ok: true }
}

export async function softDeleteFeeType(
  id: string
): Promise<FeeTypeActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data, error } = await ctx.supabase
    .from('fee_types')
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
    return { ok: false, message: 'Nem sikerült törölni a díj típust.' }
  }

  if (!data) {
    return { ok: false, message: 'A díj típus nem található.' }
  }

  revalidatePath(LIST_PATH)
  return { ok: true }
}
