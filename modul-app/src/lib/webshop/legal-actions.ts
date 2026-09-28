'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { getTenantCompany } from '@/lib/company/queries'
import { revalidateStorefrontTenant } from '@/lib/storefront/revalidate'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'
import { COUNTY_CODES } from '@/lib/webshop/legal/constants'
import { sellerDefaultsOf } from '@/lib/webshop/legal/context'
import { countyFromPostalCode, countyFromRegistration } from '@/lib/webshop/legal/derive'
import { scheduleLegalSync } from '@/lib/webshop/legal/schedule'

export type LegalActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const text = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      const t = v?.trim() ?? ''
      return t ? t : null
    })
    .refine((v) => v == null || v.length <= max, `Legfeljebb ${max} karakter.`)

const email = text(200).refine(
  (v) => v == null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  'Érvényes e-mail címet adj meg.'
)

const url = (label: string) =>
  text(500).refine((v) => v == null || /^(https?:\/\/|\/)\S+$/i.test(v), `${label}: https://… vagy /… kezdetű cím legyen.`)

const legalSchema = z.object({
  sellerName: text(200),
  postalCode: text(10),
  city: text(100),
  address: text(200),
  email,
  phone: text(40),
  taxNumber: text(20),
  registrationNumber: text(30),
  vatId: text(20),
  county: z.union([z.enum(COUNTY_CODES), z.literal(''), z.null()]).transform((v) => (v ? v : null)),
  serviceAddress: text(300),
  supportHours: text(160),
  audience: z.enum(['consumer', 'business']),
  madeToOrder: z.boolean(),
  mandatoryWarranty: z.boolean(),
  newsletter: z.boolean(),
  microEnterprise: z.boolean(),
  termsUrl: url('ÁSZF'),
  privacyUrl: url('Adatkezelési tájékoztató')
})

export type WebshopLegalInput = z.input<typeof legalSchema>

async function requireWebshopWriter() {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return ctx
  const entitled = await tenantHasWebshop(ctx.supabase, ctx.user.tenantId!)
  if (!entitled) return { ok: false as const, message: 'A Webshop add-on nincs bekapcsolva.' }
  return ctx
}

/** Az ERP-vel egyező értéket nem tároljuk: így a Cégadatok későbbi javítása ide is átjön. */
function override(value: string | null, erp: string | null): string | null {
  return value != null && value !== erp ? value : null
}

export async function saveWebshopLegalSettings(input: WebshopLegalInput): Promise<LegalActionResult> {
  const ctx = await requireWebshopWriter()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = legalSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return { ok: false, message: 'Ellenőrizd a megjelölt mezőket.', fieldErrors }
  }
  const d = parsed.data
  const tenantId = ctx.user.tenantId!
  const company = await getTenantCompany(ctx.supabase, tenantId).catch(() => null)
  const erp = sellerDefaultsOf(company, '')

  const registration = d.registrationNumber ?? erp.registrationNumber
  const postal = d.postalCode ?? erp.postalCode
  const derived = countyFromRegistration(registration) ?? countyFromPostalCode(postal)

  const { error } = await ctx.supabase.from('tenant_webshop_settings').upsert(
    {
      tenant_id: tenantId,
      legal_seller_name: override(d.sellerName, erp.sellerName || null),
      legal_postal_code: override(d.postalCode, erp.postalCode),
      legal_city: override(d.city, erp.city),
      legal_address: override(d.address, erp.address),
      legal_email: override(d.email, erp.email),
      legal_phone: override(d.phone, erp.phone),
      legal_tax_number: override(d.taxNumber, erp.taxNumber),
      legal_registration_number: override(d.registrationNumber, erp.registrationNumber),
      legal_vat_id: override(d.vatId, erp.vatId),
      legal_county: d.county && d.county !== derived ? d.county : null,
      service_address: d.serviceAddress,
      support_hours: d.supportHours,
      audience: d.audience,
      made_to_order: d.madeToOrder,
      mandatory_warranty: d.mandatoryWarranty,
      newsletter: d.newsletter,
      micro_enterprise: d.microEnterprise,
      terms_url: d.termsUrl,
      privacy_url: d.privacyUrl,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'tenant_id' }
  )
  if (error) {
    console.error('saveWebshopLegalSettings', error.message)
    if (error.code === '42703') {
      return { ok: false, message: 'Hiányzik a 20260551 migráció. Futtasd, majd mentsd újra.' }
    }
    return { ok: false, message: 'Nem sikerült menteni a jogi adatokat.' }
  }

  revalidatePath('/webshop/jogi')
  revalidatePath('/webshop')
  await revalidateStorefrontTenant(tenantId)
  scheduleLegalSync(tenantId)
  return { ok: true }
}

export async function setWithdrawalHandled(id: string, handled: boolean): Promise<LegalActionResult> {
  const ctx = await requireWebshopWriter()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  if (!z.string().uuid().safeParse(id).success) return { ok: false, message: 'Hibás azonosító.' }

  const { data, error } = await ctx.supabase
    .from('webshop_withdrawals')
    .update(
      handled
        ? { handled_at: new Date().toISOString(), handled_by: ctx.user.id }
        : { handled_at: null, handled_by: null }
    )
    .eq('id', id)
    .eq('tenant_id', ctx.user.tenantId!)
    .select('id')
    .maybeSingle()
  if (error) {
    console.error('setWithdrawalHandled', error.message)
    return { ok: false, message: 'Nem sikerült menteni.' }
  }
  if (!data) return { ok: false, message: 'Az elállás nem található.' }

  revalidatePath('/webshop/elallasok')
  revalidatePath('/webshop')
  return { ok: true }
}
