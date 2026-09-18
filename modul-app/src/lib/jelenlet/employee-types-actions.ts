'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type EmployeeTypeActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const PATHS = ['/dolgozok/tipusok', '/dolgozok', '/dolgozok/uj'] as const

const typeFormSchema = z.object({
  name: z.string().trim().min(1, 'Add meg a nevet.').max(80),
  code: z.string().trim().max(40).optional().default(''),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  active: z.boolean(),
  isDefault: z.boolean()
})

function revalidate() {
  for (const p of PATHS) revalidatePath(p)
}

function fieldErrorsFromZod(
  issues: { path: (string | number)[]; message: string }[]
) {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path.map(String).join('.')
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return fieldErrors
}

async function clearOtherDefaults(
  supabase: SupabaseClient,
  tenantId: string,
  exceptId?: string
) {
  let q = supabase
    .from('hr_employee_types')
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .is('deleted_at', null)
  if (exceptId) q = q.neq('id', exceptId)
  await q
}

export async function createEmployeeType(input: {
  name: string
  code?: string
  sortOrder: number
  active: boolean
  isDefault: boolean
}): Promise<EmployeeTypeActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = typeFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a mezőket.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }
  const d = parsed.data
  const tenantId = ctx.user.tenantId!

  if (d.isDefault) {
    await clearOtherDefaults(ctx.supabase, tenantId)
  }

  const { error } = await ctx.supabase.from('hr_employee_types').insert({
    tenant_id: tenantId,
    name: d.name,
    code: d.code ?? '',
    sort_order: d.sortOrder,
    active: d.active,
    is_default: d.isDefault
  })

  if (error) {
    if (error.message.includes('hr_employee_types_tenant_name')) {
      return {
        ok: false,
        message: 'Már van ilyen nevű típus.',
        fieldErrors: { name: 'Már van ilyen nevű típus.' }
      }
    }
    return { ok: false, message: error.message }
  }
  revalidate()
  return { ok: true }
}

export async function updateEmployeeType(input: {
  id: string
  name: string
  code?: string
  sortOrder: number
  active: boolean
  isDefault: boolean
}): Promise<EmployeeTypeActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = typeFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a mezőket.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }
  const d = parsed.data
  const tenantId = ctx.user.tenantId!

  if (d.isDefault) {
    await clearOtherDefaults(ctx.supabase, tenantId, input.id)
  }

  const { data, error } = await ctx.supabase
    .from('hr_employee_types')
    .update({
      name: d.name,
      code: d.code ?? '',
      sort_order: d.sortOrder,
      active: d.active,
      is_default: d.isDefault,
      updated_at: new Date().toISOString()
    })
    .eq('id', input.id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    if (error.message.includes('hr_employee_types_tenant_name')) {
      return {
        ok: false,
        message: 'Már van ilyen nevű típus.',
        fieldErrors: { name: 'Már van ilyen nevű típus.' }
      }
    }
    return { ok: false, message: error.message }
  }
  if (!data) return { ok: false, message: 'Típus nem található.' }
  revalidate()
  return { ok: true }
}

export async function softDeleteEmployeeType(input: {
  id: string
}): Promise<EmployeeTypeActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!

  const { data: row } = await ctx.supabase
    .from('hr_employee_types')
    .select('id, is_default')
    .eq('id', input.id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!row) return { ok: false, message: 'Típus nem található.' }
  if (row.is_default) {
    return {
      ok: false,
      message: 'Az alapértelmezett típust nem lehet törölni.'
    }
  }

  const { count } = await ctx.supabase
    .from('hr_employees')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('employee_type_id', input.id)

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      message: `${count} dolgozó használja — előbb állíts át típust.`
    }
  }

  const { error } = await ctx.supabase
    .from('hr_employee_types')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_default: false
    })
    .eq('id', input.id)
    .eq('tenant_id', tenantId)

  if (error) return { ok: false, message: error.message }
  revalidate()
  return { ok: true }
}
