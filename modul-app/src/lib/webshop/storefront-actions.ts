'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { revalidateStorefrontTenant } from '@/lib/storefront/revalidate'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'
import { STATUTORY_RETURN_DAYS } from '@/lib/webshop/settings'

export type StorefrontActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const optionalNonNegInt = (label: string, max: number) =>
  z
    .union([z.number(), z.null(), z.undefined()])
    .transform((v) => (v == null ? null : v))
    .refine(
      (v) => v == null || (Number.isInteger(v) && v >= 0 && v <= max),
      `${label}: 0 és ${max} közötti egész szám.`
    )

const optionalText = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v == null) return null
      const t = v.trim()
      return t.length > 0 ? t : null
    })
    .refine((v) => v == null || v.length <= max, `Legfeljebb ${max} karakter.`)

const optionalUrl = (label: string) =>
  optionalText(500).refine(
    (v) => v == null || /^(https?:\/\/|\/)\S+$/i.test(v),
    `${label}: https://… vagy /… kezdetű cím legyen.`
  )

const optionalEmail = (label: string) =>
  optionalText(200).refine(
    (v) => v == null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    `${label}: érvényes e-mail címet adj meg.`
  )

const settingsSchema = z
  .object({
    shippingFeeGross: optionalNonNegInt('Szállítási díj', 1_000_000),
    freeShippingThresholdGross: optionalNonNegInt(
      'Ingyenes szállítás határ',
      100_000_000
    ),
    deliveryDaysMin: optionalNonNegInt('Szállítási idő (min)', 60),
    deliveryDaysMax: optionalNonNegInt('Szállítási idő (max)', 60),
    pickupEnabled: z.boolean(),
    pickupLabel: optionalText(160),
    returnDays: optionalNonNegInt('Visszaküldés', 365),
    warrantyMonths: optionalNonNegInt('Garancia', 240),
    returnPolicyText: optionalText(1500),
    lowStockThreshold: z
      .number()
      .int('Egész szám legyen.')
      .min(0)
      .max(1000),
    showSoldCount: z.boolean(),
    reviewsEnabled: z.boolean(),
    hostingProviderName: optionalText(200),
    hostingProviderAddress: optionalText(300),
    hostingProviderEmail: optionalEmail('Tárhely-szolgáltató e-mail'),
    termsUrl: optionalUrl('ÁSZF'),
    privacyUrl: optionalUrl('Adatkezelési tájékoztató'),
    complaintInfo: optionalText(1500),
    allowAiTraining: z.boolean().default(false)
  })
  .superRefine((d, ctx) => {
    if (d.returnDays != null && d.returnDays < STATUTORY_RETURN_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['returnDays'],
        message: `Legalább ${STATUTORY_RETURN_DAYS} nap — ennyi a törvényes elállási idő.`
      })
    }
    if (
      d.deliveryDaysMin != null &&
      d.deliveryDaysMax != null &&
      d.deliveryDaysMax < d.deliveryDaysMin
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deliveryDaysMax'],
        message: 'A max nem lehet kisebb a minnél.'
      })
    }
  })

export type StorefrontSettingsInput = z.input<typeof settingsSchema>

async function requireWebshopWriter() {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return ctx
  const entitled = await tenantHasWebshop(ctx.supabase, ctx.user.tenantId!)
  if (!entitled) {
    return { ok: false as const, message: 'A Webshop add-on nincs bekapcsolva.' }
  }
  return ctx
}

export async function saveStorefrontSettings(
  input: StorefrontSettingsInput
): Promise<StorefrontActionResult> {
  const ctx = await requireWebshopWriter()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = settingsSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && !fieldErrors[key]) {
        fieldErrors[key] = issue.message
      }
    }
    return { ok: false, message: 'Ellenőrizd a megadott adatokat.', fieldErrors }
  }

  const d = parsed.data
  const { error } = await ctx.supabase.from('tenant_webshop_settings').upsert(
    {
      tenant_id: ctx.user.tenantId!,
      shipping_fee_gross: d.shippingFeeGross,
      free_shipping_threshold_gross: d.freeShippingThresholdGross,
      delivery_days_min: d.deliveryDaysMin,
      delivery_days_max: d.deliveryDaysMax,
      pickup_enabled: d.pickupEnabled,
      pickup_label: d.pickupLabel,
      return_days: d.returnDays,
      warranty_months: d.warrantyMonths,
      return_policy_text: d.returnPolicyText,
      low_stock_threshold: d.lowStockThreshold,
      show_sold_count: d.showSoldCount,
      reviews_enabled: d.reviewsEnabled,
      hosting_provider_name: d.hostingProviderName,
      hosting_provider_address: d.hostingProviderAddress,
      hosting_provider_email: d.hostingProviderEmail,
      terms_url: d.termsUrl,
      privacy_url: d.privacyUrl,
      complaint_info: d.complaintInfo,
      allow_ai_training: d.allowAiTraining,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'tenant_id' }
  )

  if (error) {
    console.error('saveStorefrontSettings', error.message)
    return { ok: false, message: 'Nem sikerült menteni a beállításokat.' }
  }

  revalidatePath('/webshop/beallitasok')
  await revalidateStorefrontTenant(ctx.user.tenantId!)
  return { ok: true }
}

const moderateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['approved', 'rejected', 'pending']).optional(),
  sellerReply: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v == null ? undefined : v.trim()))
    .refine((v) => v == null || v.length <= 2000, 'Legfeljebb 2000 karakter.')
})

export async function moderateProductReview(
  input: z.input<typeof moderateSchema>
): Promise<StorefrontActionResult> {
  const ctx = await requireWebshopWriter()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = moderateSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Hibás adat.' }
  }

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { updated_at: now }
  if (parsed.data.status) {
    patch.status = parsed.data.status
    patch.moderated_at = now
    patch.moderated_by = ctx.user.id
  }
  if (parsed.data.sellerReply !== undefined) {
    const reply = parsed.data.sellerReply
    patch.seller_reply = reply ? reply : null
    patch.seller_replied_at = reply ? now : null
  }

  const { data, error } = await ctx.supabase
    .from('product_reviews')
    .update(patch)
    .eq('id', parsed.data.id)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('moderateProductReview', error.message)
    return { ok: false, message: 'Nem sikerült menteni az értékelést.' }
  }
  if (!data) return { ok: false, message: 'Az értékelés nem található.' }

  revalidatePath('/webshop/ertekelesek')
  return { ok: true }
}

export async function closeStockNotifyRequest(
  id: string
): Promise<StorefrontActionResult> {
  const ctx = await requireWebshopWriter()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, message: 'Hibás azonosító.' }
  }

  const { data, error } = await ctx.supabase
    .from('storefront_stock_notify_requests')
    .update({ notified_at: new Date().toISOString(), notified_by: ctx.user.id })
    .eq('id', id)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('notified_at', null)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('closeStockNotifyRequest', error.message)
    return { ok: false, message: 'Nem sikerült lezárni a kérést.' }
  }
  if (!data) return { ok: false, message: 'A kérés már le van zárva.' }

  revalidatePath('/webshop')
  return { ok: true }
}
