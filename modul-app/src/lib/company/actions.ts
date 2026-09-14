'use server'

import { revalidatePath } from 'next/cache'

import {
  companyFormSchema,
  type CompanyFormInput
} from '@/lib/company/parse'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type CompanyActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const PAGE_PATH = '/beallitasok/cegadatok'

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

export async function upsertTenantCompany(
  input: CompanyFormInput
): Promise<CompanyActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = companyFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const tenantId = ctx.user.tenantId!
  const d = parsed.data
  const row = {
    tenant_id: tenantId,
    name: d.name,
    country: d.country,
    postal_code: d.postalCode,
    city: d.city,
    address: d.address,
    phone_number: d.phoneNumber,
    email: d.email,
    website: d.website,
    tax_number: d.taxNumber,
    company_registration_number: d.companyRegistrationNumber,
    vat_id: d.vatId,
    logo_url: d.logoUrl,
    quote_validity_days: d.quoteValidityDays,
    updated_at: new Date().toISOString()
  }

  const { error } = await ctx.supabase.from('tenant_companies').upsert(row, {
    onConflict: 'tenant_id'
  })

  if (error) {
    console.error('upsertTenantCompany', error.message)
    return { ok: false, message: 'Nem sikerült menteni a cégadatokat.' }
  }

  // Topbar / session display név szinkron
  const { error: tenantError } = await ctx.supabase
    .from('tenants')
    .update({ name: d.name, updated_at: new Date().toISOString() })
    .eq('id', tenantId)

  if (tenantError) {
    console.error('upsertTenantCompany tenants.name', tenantError.message)
  }

  const { markOnboardingFlag } = await import(
    '@/lib/platform/onboarding-flags'
  )
  await markOnboardingFlag(tenantId, { company_profile_done: true })

  revalidatePath(PAGE_PATH)
  revalidatePath('/home')
  return { ok: true }
}
