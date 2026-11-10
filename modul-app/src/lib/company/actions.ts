'use server'

import { revalidatePath } from 'next/cache'

import {
  generateGoogleReviewCode,
  googleReviewInputError,
  parseGoogleReviewInput
} from '@/lib/company/google-profile'
import {
  companyFormSchema,
  type CompanyFormInput
} from '@/lib/company/parse'
import {
  draftToOpeningHours,
  type DayKey,
  type OpeningHoursDraft
} from '@/lib/opening-hours'
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

export type OpeningHoursActionResult =
  | { ok: true }
  | {
      ok: false
      message: string
      dayErrors?: Partial<Record<DayKey, string>>
    }

const OPENING_NOTE_MAX = 300

export async function updateTenantOpeningHours(input: {
  draft: OpeningHoursDraft
  note: string
}): Promise<OpeningHoursActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = draftToOpeningHours(input.draft)
  if (!parsed.ok) {
    return {
      ok: false,
      message: 'Ellenőrizd a nyitvatartást.',
      dayErrors: parsed.errors
    }
  }
  const note = input.note.trim()
  if (note.length > OPENING_NOTE_MAX) {
    return {
      ok: false,
      message: `A megjegyzés legfeljebb ${OPENING_NOTE_MAX} karakter lehet.`
    }
  }

  const tenantId = ctx.user.tenantId!
  const { error } = await ctx.supabase
    .from('tenant_companies')
    .update({
      opening_hours: parsed.value,
      opening_hours_note: note || null,
      updated_at: new Date().toISOString()
    })
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('updateTenantOpeningHours', error.message)
    return {
      ok: false,
      message: error.message.includes('opening_hours')
        ? 'A nyitvatartás mentéséhez futtasd a 20260635 migrációt.'
        : 'Nem sikerült menteni a nyitvatartást.'
    }
  }

  revalidatePath(PAGE_PATH)
  revalidatePath('/partner/home')
  return { ok: true }
}

export type GoogleProfileActionResult =
  | { ok: true; code: string | null }
  | { ok: false; message: string; fieldError?: string }

/** Értékelő link mentése; az első mentéskor egyszer generál rövid link kódot. */
export async function updateTenantGoogleProfile(input: {
  reviewUrl: string
}): Promise<GoogleProfileActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = parseGoogleReviewInput(input.reviewUrl)
  const inputError = googleReviewInputError(parsed)
  if (inputError) {
    return { ok: false, message: 'Ellenőrizd a Google értékelő linket.', fieldError: inputError }
  }

  const tenantId = ctx.user.tenantId!
  const { data: current, error: readError } = await ctx.supabase
    .from('tenant_companies')
    .select('google_review_url, google_review_code')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (readError) {
    console.error('updateTenantGoogleProfile read', readError.message)
    return {
      ok: false,
      message:
        readError.code === '42703'
          ? 'A Google cégprofil mentéséhez futtasd a 20261003 migrációt.'
          : 'Nem sikerült menteni a Google cégprofilt.'
    }
  }

  const unchanged = (current?.google_review_url ?? null) === parsed.reviewUrl
  let code: string | null = current?.google_review_code ?? null
  if (unchanged && (code || !parsed.reviewUrl)) return { ok: true, code }

  const now = new Date().toISOString()
  const needsCode = !code && parsed.reviewUrl !== null

  for (let attempt = 0; attempt < 3; attempt++) {
    const nextCode = needsCode ? generateGoogleReviewCode() : code
    const { error } = await ctx.supabase
      .from('tenant_companies')
      .update({
        google_review_url: parsed.reviewUrl,
        google_place_id: parsed.placeId,
        google_review_code: nextCode,
        google_profile_updated_at: now,
        updated_at: now
      })
      .eq('tenant_id', tenantId)

    if (!error) {
      code = nextCode
      revalidatePath(PAGE_PATH)
      return { ok: true, code }
    }
    // 23505 = unique_violation: ritka kódütközés, új kóddal újra
    if (!(needsCode && error.code === '23505')) {
      console.error('updateTenantGoogleProfile', error.message)
      return { ok: false, message: 'Nem sikerült menteni a Google cégprofilt.' }
    }
  }

  return { ok: false, message: 'Nem sikerült rövid linket generálni. Próbáld újra.' }
}
