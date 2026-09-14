'use server'

import { revalidatePath } from 'next/cache'

import {
  parsePercentInput,
  taxRateFormSchema
} from '@/lib/tax-rates/parse'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type TaxRateActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const ADONEM_PATH = '/torzsadatok/rendszer/adonem'

function mapUniqueNameError(message: string): string | null {
  if (
    message.includes('tax_rates_tenant_name_alive') ||
    message.includes('duplicate key')
  ) {
    return 'Már van ilyen nevű adónem ebben a cégben.'
  }
  return null
}

export async function createTaxRate(input: {
  name: string
  ratePercentRaw: string
}): Promise<TaxRateActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const ratePercent = parsePercentInput(input.ratePercentRaw)
  const parsed = taxRateFormSchema.safeParse({
    name: input.name,
    ratePercent
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && !fieldErrors[key]) {
        fieldErrors[key] = issue.message
      }
    }
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors
    }
  }

  const { error } = await ctx.supabase.from('tax_rates').insert({
    tenant_id: ctx.user.tenantId!,
    name: parsed.data.name,
    rate_percent: parsed.data.ratePercent,
    is_default: false
  })

  if (error) {
    const unique = mapUniqueNameError(error.message)
    return {
      ok: false,
      message: unique ?? 'Nem sikerült létrehozni az adónemet.',
      fieldErrors: unique ? { name: unique } : undefined
    }
  }

  revalidatePath(ADONEM_PATH)
  return { ok: true }
}

export async function updateTaxRate(input: {
  id: string
  name: string
  ratePercentRaw: string
}): Promise<TaxRateActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const ratePercent = parsePercentInput(input.ratePercentRaw)
  const parsed = taxRateFormSchema.safeParse({
    name: input.name,
    ratePercent
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && !fieldErrors[key]) {
        fieldErrors[key] = issue.message
      }
    }
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors
    }
  }

  const { data, error } = await ctx.supabase
    .from('tax_rates')
    .update({
      name: parsed.data.name,
      rate_percent: parsed.data.ratePercent,
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
      message: unique ?? 'Nem sikerült menteni az adónemet.',
      fieldErrors: unique ? { name: unique } : undefined
    }
  }

  if (!data) {
    return { ok: false, message: 'Az adónem nem található.' }
  }

  revalidatePath(ADONEM_PATH)
  return { ok: true }
}

export async function softDeleteTaxRate(
  id: string
): Promise<TaxRateActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data, error } = await ctx.supabase
    .from('tax_rates')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_default: false
    })
    .eq('id', id)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    return { ok: false, message: 'Nem sikerült törölni az adónemet.' }
  }

  if (!data) {
    return { ok: false, message: 'Az adónem nem található.' }
  }

  revalidatePath(ADONEM_PATH)
  return { ok: true }
}
