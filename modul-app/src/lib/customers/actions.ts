'use server'

import { revalidatePath } from 'next/cache'

import {
  customerFormSchema,
  type CustomerFormValues
} from '@/lib/customers/parse'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type CustomerActionResult =
  | { ok: true; id: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const LIST_PATH = '/ugyfelek'

function revalidateCustomerPaths(id?: string) {
  revalidatePath(LIST_PATH)
  if (id) revalidatePath(`${LIST_PATH}/${id}`)
  revalidatePath(`${LIST_PATH}/uj`)
}

function mapDbError(message: string): string | null {
  if (
    message.includes('customers_tenant_name_alive') ||
    message.includes('duplicate key')
  ) {
    return 'Már van ilyen nevű ügyfél ebben a cégben.'
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

function rowFromParsed(data: CustomerFormValues) {
  return {
    name: data.name,
    email: data.email,
    mobile: data.mobile,
    sms_notification: data.smsNotification,
    billing_name: data.billingName,
    billing_country: data.billingCountry,
    billing_city: data.billingCity,
    billing_postal_code: data.billingPostalCode,
    billing_street: data.billingStreet,
    billing_house_number: data.billingHouseNumber,
    billing_tax_number: data.billingTaxNumber,
    billing_company_reg_number: data.billingCompanyRegNumber
  }
}

export type CustomerFormInput = {
  name: string
  email: string
  mobile: string
  smsNotification: boolean
  billingName: string
  billingCountry: string
  billingCity: string
  billingPostalCode: string
  billingStreet: string
  billingHouseNumber: string
  billingTaxNumber: string
  billingCompanyRegNumber: string
}

export async function createCustomer(
  input: CustomerFormInput
): Promise<CustomerActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = customerFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const { data, error } = await ctx.supabase
    .from('customers')
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
      message: mapped ?? 'Nem sikerült létrehozni az ügyfelet.',
      fieldErrors: mapped ? { name: mapped } : undefined
    }
  }

  revalidateCustomerPaths(data.id)
  return { ok: true, id: data.id }
}

export async function updateCustomer(
  input: CustomerFormInput & { id: string }
): Promise<CustomerActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = customerFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const { data, error } = await ctx.supabase
    .from('customers')
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
      message: mapped ?? 'Nem sikerült menteni az ügyfelet.',
      fieldErrors: mapped ? { name: mapped } : undefined
    }
  }

  if (!data) {
    return { ok: false, message: 'Az ügyfél nem található.' }
  }

  revalidateCustomerPaths(data.id)
  return { ok: true, id: data.id }
}

export async function softDeleteCustomer(
  id: string
): Promise<CustomerActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data, error } = await ctx.supabase
    .from('customers')
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
    return { ok: false, message: 'Nem sikerült törölni az ügyfelet.' }
  }

  if (!data) {
    return { ok: false, message: 'Az ügyfél nem található.' }
  }

  revalidateCustomerPaths(data.id)
  return { ok: true, id: data.id }
}
