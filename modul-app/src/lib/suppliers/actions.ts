'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  supplierFormSchema,
  type SupplierFormInput,
  type SupplierFormValues
} from '@/lib/suppliers/parse'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type SupplierActionResult =
  | { ok: true; id: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const LIST_PATH = '/beszallitok'

function revalidateSupplierPaths(id?: string) {
  revalidatePath(LIST_PATH)
  if (id) revalidatePath(`${LIST_PATH}/${id}`)
  revalidatePath(`${LIST_PATH}/uj`)
}

function mapDbError(message: string): string | null {
  if (
    message.includes('suppliers_tenant_name_alive') ||
    message.includes('duplicate key')
  ) {
    return 'Már van ilyen nevű beszállító ebben a cégben.'
  }
  if (message.includes('supplier_addresses_one_default')) {
    return 'Csak egy alapértelmezett cím lehet.'
  }
  if (message.includes('supplier_contacts_one_primary')) {
    return 'Csak egy elsődleges kapcsolattartó lehet.'
  }
  return null
}

function fieldErrorsFromZod(
  issues: { path: (string | number)[]; message: string }[]
) {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path.map(String).join('.')
    if (key && !fieldErrors[key]) {
      fieldErrors[key] = issue.message
    }
    const root = issue.path[0]
    if (typeof root === 'string' && !fieldErrors[root]) {
      fieldErrors[root] = issue.message
    }
  }
  return fieldErrors
}

function headerFromParsed(data: SupplierFormValues) {
  return {
    name: data.name,
    email: data.email,
    phone: data.phone,
    website: data.website,
    tax_number: data.taxNumber,
    eu_vat_number: data.euVatNumber,
    company_reg_number: data.companyRegNumber,
    iban: data.iban,
    bic: data.bic,
    account_holder: data.accountHolder,
    notes: data.notes,
    status: data.status,
    default_currency: data.defaultCurrency,
    default_tax_rate_id: data.defaultTaxRateId,
    default_payment_method_id: data.defaultPaymentMethodId,
    default_payment_terms_days: data.defaultPaymentTermsDays
  }
}

async function replaceChildren(
  supabase: SupabaseClient,
  tenantId: string,
  supplierId: string,
  data: SupplierFormValues
): Promise<string | null> {
  const { error: addrDelErr } = await supabase
    .from('supplier_addresses')
    .delete()
    .eq('supplier_id', supplierId)
  if (addrDelErr) return addrDelErr.message

  const { error: contactDelErr } = await supabase
    .from('supplier_contacts')
    .delete()
    .eq('supplier_id', supplierId)
  if (contactDelErr) return contactDelErr.message

  if (data.addresses.length > 0) {
    const { error } = await supabase.from('supplier_addresses').insert(
      data.addresses.map((a) => ({
        tenant_id: tenantId,
        supplier_id: supplierId,
        label: a.label,
        address_type: a.addressType,
        country: a.country,
        postal_code: a.postalCode,
        city: a.city,
        street: a.street,
        house_number: a.houseNumber,
        is_default: a.isDefault
      }))
    )
    if (error) return error.message
  }

  if (data.contacts.length > 0) {
    const { error } = await supabase.from('supplier_contacts').insert(
      data.contacts.map((c) => ({
        tenant_id: tenantId,
        supplier_id: supplierId,
        name: c.name,
        email: c.email,
        phone: c.phone,
        is_primary: c.isPrimary,
        note: c.note
      }))
    )
    if (error) return error.message
  }

  return null
}

export async function createSupplier(
  input: SupplierFormInput
): Promise<SupplierActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = supplierFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const tenantId = ctx.user.tenantId!
  const { data, error } = await ctx.supabase
    .from('suppliers')
    .insert({
      tenant_id: tenantId,
      ...headerFromParsed(parsed.data)
    })
    .select('id')
    .single()

  if (error || !data) {
    const mapped = error ? mapDbError(error.message) : null
    return {
      ok: false,
      message: mapped ?? 'Nem sikerült létrehozni a beszállítót.',
      fieldErrors: mapped ? { name: mapped } : undefined
    }
  }

  const childErr = await replaceChildren(
    ctx.supabase,
    tenantId,
    data.id,
    parsed.data
  )
  if (childErr) {
    await ctx.supabase.from('suppliers').delete().eq('id', data.id)
    const mapped = mapDbError(childErr)
    return {
      ok: false,
      message: mapped ?? 'Nem sikerült menteni a címeket / kapcsolattartókat.'
    }
  }

  revalidateSupplierPaths(data.id)
  return { ok: true, id: data.id }
}

export async function updateSupplier(
  input: SupplierFormInput & { id: string }
): Promise<SupplierActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = supplierFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const tenantId = ctx.user.tenantId!
  const { data, error } = await ctx.supabase
    .from('suppliers')
    .update({
      ...headerFromParsed(parsed.data),
      updated_at: new Date().toISOString()
    })
    .eq('id', input.id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    const mapped = mapDbError(error.message)
    return {
      ok: false,
      message: mapped ?? 'Nem sikerült menteni a beszállítót.',
      fieldErrors: mapped ? { name: mapped } : undefined
    }
  }

  if (!data) {
    return { ok: false, message: 'A beszállító nem található.' }
  }

  const childErr = await replaceChildren(
    ctx.supabase,
    tenantId,
    data.id,
    parsed.data
  )
  if (childErr) {
    const mapped = mapDbError(childErr)
    return {
      ok: false,
      message: mapped ?? 'Nem sikerült menteni a címeket / kapcsolattartókat.'
    }
  }

  revalidateSupplierPaths(data.id)
  return { ok: true, id: data.id }
}

export async function softDeleteSupplier(
  id: string
): Promise<SupplierActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data, error } = await ctx.supabase
    .from('suppliers')
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
    return { ok: false, message: 'Nem sikerült törölni a beszállítót.' }
  }

  if (!data) {
    return { ok: false, message: 'A beszállító nem található.' }
  }

  revalidateSupplierPaths(data.id)
  return { ok: true, id: data.id }
}
